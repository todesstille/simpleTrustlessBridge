const {
  time
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { constants } = require("ethers");
const { ethers } = require("hardhat");
let admin, alice, bob, charlie, tokenAmount;
let Bridge, bridge1, bridge2;

const sign = async (signer, from, fromChain, to, toChain, amount, nonce) => {
  const domain = {
    name: "Trustless Bridge",
    version: "0.1",
    chainId: 0,
    verifyingContract: ethers.constants.AddressZero
  };
  const types = {
    Deposit: [
      { name: "from", type: "address" },
      { name: "fromChain", type: "uint256" },
      { name: "to", type: "address" },
      { name: "toChain", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "nonce", type: "uint256" },
    ],
  };
  const signature = await signer._signTypedData(domain, types, {
    from,
    fromChain,
    to,
    toChain,
    amount,
    nonce
  });
  return signature;
};

describe("Bridge", function () {

  before(async () => {
    [admin, alice, bob, charlie] = await ethers.getSigners();
    Bridge = await ethers.getContractFactory("Bridge");
    tokenAmount = await ethers.utils.parseUnits("1000000.0", 18);
  });
  
  beforeEach(async () => {
    bridge1 = await Bridge.deploy(admin.address, 1);
    bridge2 = await Bridge.deploy(admin.address, 2);
    await bridge1.mint(bridge1.address, tokenAmount);
    await bridge2.mint(bridge2.address, tokenAmount);
  });
  
  describe("Deployed correctly", function () {
    it("Tokens deployed correctly", async function () {
      expect(await bridge1.name()).to.equal("Bridge Token");
      expect(await bridge2.name()).to.equal("Bridge Token");
      expect(await bridge1.symbol()).to.equal("BTOKEN");
      expect(await bridge2.symbol()).to.equal("BTOKEN");
      expect(await bridge1.balanceOf(bridge1.address)).to.equal(tokenAmount);
      expect(await bridge2.balanceOf(bridge2.address)).to.equal(tokenAmount);
    });

    it("Bridge parameters deployed correctly", async function () {
      expect(await bridge1.validator()).to.equal(admin.address);
      expect(await bridge2.validator()).to.equal(admin.address);
      expect(await bridge1.chainId()).to.equal(1);
      expect(await bridge2.chainId()).to.equal(2);
    });
  });
  describe("Random out of system tests. Rewrite", function () {
    it("Tests the whole scheme", async function () {
      let sendAmount = await ethers.utils.parseUnits("1.0", 18);
      let depositId = await bridge1.connect(alice).callStatic.deposit(bob.address, 2, sendAmount);
      await bridge1.connect(alice).deposit(bob.address, 2, sendAmount);
      let signature = await sign(admin, alice.address, 1, bob.address, 2, sendAmount, 0);

      await bridge1.send(depositId, signature);
      await bridge2.withdraw(alice.address, 1, bob.address, sendAmount, 0, signature);
    });
  });

});
