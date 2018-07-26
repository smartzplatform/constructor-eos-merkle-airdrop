import time

from smartz.api.constructor_engine import ConstructorInstance


class Constructor(ConstructorInstance):

    def get_version(self):
        return {
            "result": "success",
            "blockchain": "eos",
            "version": 2
        }

    def get_params(self):
        json_schema = {
            "type": "object",
            "required": [
                "tokenSymbol", "tokenDecimals", "tokenContractName"
            ],
            "additionalProperties": False,

            "eosProps": {
                "permissions": [{
                    "name": "eosio.code"
                }]
            },

            "properties": {
                "tokenSymbol": {
                    "title": "Token symbol",
                    "description": "Symbol of token for airdrop (1..7 characters, upper case only)",
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 7,
                    "pattern": '^[A-Z]+$'
                },

                "tokenDecimals": {
                    "title": "Token decimals",
                    "description": "Token decimals count (0..255)",
                    "type": "integer",
                    "minLength": 0,
                    "maxLength": 255
                },

                "tokenContractName": {
                    "title": "Token contract name",
                    "description": "Name of token contract (1..12 characters, lower case only)",
                    "type": "string",
                    "minLength": 1,
                    "maxLength": 12,
                    "pattern": '^[a-z.]+$'
                },
            }
        }

        ui_schema = {}

        return {
            "result": "success",
            "schema": json_schema,
            "ui_schema": ui_schema
        }

    def construct(self, fields):

        source = self.__class__._TEMPLATE \
            .replace('%token_symbol%', fields['tokenSymbol']) \
            .replace('%token_decimals%', str(fields['tokenDecimals'])) \
            .replace('%token_contract%', fields['tokenContractName'])

        return {
            "result": "success",
            'source': source,
            'contract_name': "MerkleAirdrop"
        }

    def post_construct(self, fields, abi_array):

        function_titles = {
            'mroot': {
                'title': 'Merkle root',
                'sorting_order': 10,
                'description': 'Merkle root'
            },
            'setroot': {
                'title': 'Set Merkle Root',
                'sorting_order': 20,
                'description': 'Set root of Merkle Tree',
                'inputs': [{
                    'title': 'Merkle root',
                    'ui:widget': 'merkleRoot',
                    "ui:options": {
                        "blockchain": "eos",
                    }
                }]
            },
            'mint': {
                'title': 'Mint Tokens',
                'sorting_order': 30,
                'description': 'Mint tokens',
                'inputs': [{
                    'title': 'Sender account name',
                },{
                    'title': 'Tokens amount',
                },{
                    'title': 'Merkle proof',
                    'ui:widget': 'merkleProof',
                    'ui:options': {
                        'blockchain': 'eos',
                    }
                }]
            }
        }

        return {
            "result": "success",
            'function_specs': function_titles,
            'dashboard_functions': ['setroot', 'mint', 'mroot']
        }


    # language=C++
    _TEMPLATE = """
#include <eosiolib/asset.hpp>
#include <eosiolib/crypto.h>
#include <eosiolib/eosio.hpp>
#include <eosiolib/singleton.hpp>
#include <eosiolib/currency.hpp>

static constexpr uint64_t token_symbol = S(%token_decimals%, %token_symbol%); // precision, symbol
static constexpr account_name token_contract = N(%token_contract%); // token contract name


using eosio::asset;
using eosio::extended_asset;
using eosio::singleton;
using eosio::currency;
using eosio::multi_index;


/**
 *   Uses only for abi generation
 *   Because by default abi don't generate for singletone<> table
 */
namespace abi_stuff {

// @abi table
struct mroot {
    account_name name;
    checksum256 mroot;
};

} //namespace abi_stuff


class merkle_airdrop : public eosio::contract {
public:
    // @abi action
    struct mint {
        account_name sender;
        asset amount;
        std::vector<checksum256> proof;

        EOSLIB_SERIALIZE(mint, (sender)(amount)(proof))
    };

    // @abi action
    struct setroot {
        checksum256 mroot;

        EOSLIB_SERIALIZE(setroot, (mroot))
    };

    // @abi table
    struct minted {
        account_name account;

        auto primary_key() const { return account; }

        EOSLIB_SERIALIZE(minted, (account))
    };

public:
    merkle_airdrop(account_name self)
        : contract(self)
        , _mroot(self, self)
        , _minted(self, self)
    { }

    void on(mint const & act) {
        require_auth(act.sender);

        eosio_assert(_mroot.exists(), "Merkle root is not exist");
        eosio_assert(act.amount.symbol == token_symbol, "Token symbol mismatch");
        eosio_assert(_minted.find(act.sender) == _minted.end(), "Already minted");

        std::string leaf = eosio::name{act.sender}.to_string() + " " + std::to_string(act.amount.amount);

        checksum256 leaf_hash;
        sha256(const_cast<char*>(leaf.data()), leaf.size(), &leaf_hash);

        eosio_assert(check_proof(leaf_hash, act.proof), "Merkle proof fail");

        currency::inline_transfer(_self, act.sender, extended_asset(act.amount, token_contract), "airdrop");

        _minted.emplace(_self, [&](auto & obj) {
            obj.account = act.sender;
        });
    }

    void on(setroot const & act) {
        require_auth(_self);

        eosio_assert(!_mroot.exists(), "Merkle root already exist");

        _mroot.set(act.mroot, _self);
    }

    void apply(account_name contract, account_name act) {
        if (contract != _self)
            return;

        switch (act) {
            case N(mint):
                on(eosio::unpack_action_data<mint>());
                break;
            case N(setroot):
                on(eosio::unpack_action_data<setroot>());
                break;
        }
    }

protected:
    singleton<N(mroot), checksum256> _mroot;
    multi_index<N(minted), minted> _minted;

    char* hash_cat(const checksum256 & l, const checksum256 & r) {
        static char buf[64];
        memcpy(buf, &l.hash, 32);
        memcpy(buf + 32, &r.hash, 32);
        return buf;
    };

    bool check_proof(const checksum256 & leaf, const std::vector<checksum256> & proof) {
        checksum256 current = leaf;

        for (auto && el: proof) {
            if (std::less<checksum256>()(current, el)) {
                sha256(hash_cat(current, el), 64, &current);
            } else {
                sha256(hash_cat(el, current), 64, &current);
            }
        }

        return current == _mroot.get();
    }
};


extern  "C" {

[[noreturn]] void apply(uint64_t receiver, uint64_t code, uint64_t action) {
    merkle_airdrop contract(receiver);

    contract.apply(code, action);
    eosio_exit(0);
}

}
    """
