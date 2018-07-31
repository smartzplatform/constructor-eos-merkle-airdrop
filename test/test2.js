const common = require('./helpers/common');
const expect = require('chai').expect;
require('chai').should();

const MerkleTree = require('./helpers/merkleTree');


describe("large tree", () => {
    let leafs = [];
    let merkle = null;
    let readRoot = null;

    function generateLeafs(count) {
        leafs = [];
        for (let i = 0; i < count; ++i)
            leafs.push(common.randomName() + '10000');
    }

    it("generate 10000 leafs", async function() {
        this.timeout(10000);

        generateLeafs(10000);
    });

    it("build merkle for 10000 leafs", async function () {
        this.timeout(10000);

        try {
            merkle = new MerkleTree(leafs);
        }
        catch (e) {
            e.should.be.equal("");
        }
    });

    it("compare root with dedup and without dedup for 1000 leafs", async function () {
        this.timeout(10000);

        try {
            generateLeafs(1000);
            merkle = new MerkleTree(leafs);
            let merkle2 = new MerkleTree(leafs, true);

            expect(merkle.getHexRoot()).be.equal(merkle2.getHexRoot());
        }
        catch (e) {
            e.should.be.equal("");
        }
    });

    it("build merkle for 1000000 leafs and write to file", async function() {
        this.timeout(50000);

        function randomAddress() {
            let name = "0x";
            let possible = "0123456789abcdef";

            for (let i = 0; i < 40; i++)
                name += possible.charAt(Math.floor(Math.random() * possible.length));

            return name;
        }

        function generateEthLeafs(count) {
            leafs = [];
            for (let i = 0; i < count; ++i)
                leafs.push(randomAddress() + ' ' + (parseInt(999 * Math.random()) + 1));
        }

        const fs = require('fs');
        generateEthLeafs(1000000);
        let tree = new MerkleTree(leafs);
        let data = tree.getHexRoot();
        leafs.forEach(leaf => data += "\n" + leaf);
        fs.writeFileSync('merkle_leaf.txt', data);
    });

/*
    it("read data from file & rebuild merkle & compare roots", async function () {
        this.timeout(10000);

        try {
            const fs = require('fs');
            let data = fs.readFileSync('merkle_leaf.txt').toString().split('\n').filter(d => d != '');
            readRoot = data.splice(0, 1)[0];
            leafs = data.map(it => it.split(' ')[0] + it.split(' ')[1].replace(/\./g,''));

            merkle = new MerkleTree(leafs);

            expect(merkle.getHexRoot()).be.equal(readRoot);
        }
        catch (e) {
            e.should.be.equal("");
        }
    });
*/
/*
    it("generate 1000000 leafs", async function() {
        this.timeout(10000);

        generateLeafs(1000000);
    });

    it("build merkle for 1000000 leafs", async function () {
        this.timeout(20000);

        try {
            merkle = new MerkleTree(leafs);
        }
        catch (e) {
            e.should.be.equal("");
        }
    });
*/
});
