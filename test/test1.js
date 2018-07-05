const common = require('./helpers/common');
const expect = require('chai').expect;
require('chai').should();

const MerkleTree = require('./helpers/merkleTree');


describe("", () => {
    let accounts = [];
    let contractAccount = {};
    let merkle = null;
    let leafs = [];

    it("account creation", async function () {
        this.timeout(10000);

        try {
            for (let i = 0; i < 10; i++) {
                let name = common.randomName();
                let keys = common.randomKeys();

                await common.eos().newaccount({
                    creator: "eosio",
                    name: name,
                    owner: keys.publicKey,
                    active: keys.publicKey,
                });

                accounts.push({
                    name: name,
                    keys: keys
                });
            }

            contractAccount.name = common.randomName();
            contractAccount.keys = common.randomKeys();

            await common.eos().newaccount({
                creator: "eosio",
                name: contractAccount.name,
                owner: contractAccount.keys.publicKey,
                active: contractAccount.keys.publicKey,
            });
        }
        catch (e) {
            e.should.be.equal("");
        }
    });

    it("deploy contract", async function () {
        this.timeout(10000);

        try {
            let contractFiles = common.contract('merkle-airdrop');
            expect(contractFiles).to.not.equal(null);

            let eos = common.eos(contractAccount.keys.privateKey);

            await eos.setcode(contractAccount.name, 0, 0, contractFiles.wast);
            await eos.setabi(contractAccount.name, contractFiles.abi);

            let contract = await eos.contract(contractAccount.name);
            expect(contract).to.not.equal(null);

            await eos.transfer('eosio', contractAccount.name, '100000.0000 EOS', '');

            await eos.updateauth({
                "account": contractAccount.name,
                "permission":"active",
                "parent":"owner",
                "auth":{
                    "keys":[{
                        "key": contractAccount.keys.publicKey,
                        "weight":1
                    }],
                    "threshold":1,
                    "accounts":[{
                        "permission": {
                            "actor": contractAccount.name,
                            "permission":"eosio.code"
                        },
                        "weight":1
                    }],
                    "waits":[]
                }
            }, {
                authorization: contractAccount.name
            });
        }
        catch (e) {
            e.should.be.equal("");
        }
    });

    it("set merkle root", async function () {
        this.timeout(10000);

        try {
            leafs = accounts.map(el => el.name + 10000);
            merkle = new MerkleTree(leafs);

            let eos = common.eos(contractAccount.keys.privateKey);

            let contract = await eos.contract(contractAccount.name);

            await contract.setroot({
                mroot: merkle.getRoot()
            }, {
                authorization: contractAccount.name
            });
        }
        catch (e) {
            e.should.be.equal("");
        }
    });

    it("success mint", async function () {
        this.timeout(10000);

        try {
            for (let i = 0; i < accounts.length; i++) {
                let account = accounts[i];

                let eos = common.eos([account.keys.privateKey]);
                let contract = await eos.contract(contractAccount.name);

                await contract.mint({
                    sender: account.name,
                    amount: '1.0000 EOS',
                    proof: merkle.getProof(leafs[i])
                }, {
                    authorization: account.name
                });

                let balance = await eos.getCurrencyBalance('eosio.token', account.name, 'EOS');

                expect(balance[0]).be.equal('1.0000 EOS');
            }
        }
        catch (e) {
            e.should.be.equal("");
        }
    });

    it("fail mint (incorrect amount)", async function () {
        this.timeout(10000);

        try {
            let account = accounts[0];

            let eos = common.eos([account.keys.privateKey]);
            let contract = await eos.contract(contractAccount.name);

            await contract.mint({
                sender: account.name,
                amount: '2.0000 EOS',
                proof: merkle.getProof(leafs[0])
            }, {
                authorization: account.name
            });

            expect(1).be.equal(2);
        }
        catch (e) {}
    });

    it("fail mint (incorrect proof)", async function () {
        this.timeout(10000);

        try {
            let account = accounts[0];

            let eos = common.eos([account.keys.privateKey]);
            let contract = await eos.contract(contractAccount.name);

            await contract.mint({
                sender: account.name,
                amount: '1.0000 EOS',
                proof: merkle.getProof(leafs[1])
            }, {
                authorization: account.name
            });

            expect(1).be.equal(2);
        }
        catch (e) {}
    });
});