const {
  time
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");
const { constants, utils } = require("ethers");
const { ethers } = require("hardhat");
const NONEXISTENT = 0; const PENDING = 1; const SENT = 2; const REVOKED = 3;
let admin, alice, bob, charlie, tokenAmount, lowAmount, depositId, signature;
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
    lowAmount = await ethers.utils.parseUnits("1.0", 18);
  });
  
  beforeEach(async () => {
    bridge1 = await Bridge.deploy(admin.address, 1);
    bridge2 = await Bridge.deploy(admin.address, 2);
    await bridge1.transfer(alice.address, lowAmount.mul(10))
  });
  
  describe("Deploy", function () {
    it("Tokens deployed correctly", async function () {
      expect(await bridge1.name()).to.equal("Bridge Token");
      expect(await bridge2.name()).to.equal("Bridge Token");
      expect(await bridge1.symbol()).to.equal("bTKN");
      expect(await bridge2.symbol()).to.equal("bTKN");
    });

    it("Bridge parameters deployed correctly", async function () {
      expect(await bridge1.validator()).to.equal(admin.address);
      expect(await bridge2.validator()).to.equal(admin.address);
      expect(await bridge1.chainId()).to.equal(1);
      expect(await bridge2.chainId()).to.equal(2);
    });
  });

  describe("Deposit", function () {
    it("Could not deposit with low balance", async function () {
      await expect(bridge1.connect(bob).deposit(alice.address, 2, lowAmount))
        .to.be.revertedWith("You don't have enough tokens on balance")
    });
    it("Deposit withdraws funds", async function () {
      let aliceBalance = await bridge1.balanceOf(alice.address);
      await bridge1.connect(alice).deposit(bob.address, 2, lowAmount);
      expect(await bridge1.balanceOf(alice.address)).to.equal(aliceBalance.sub(lowAmount));
    });
    it("Deposit emits event", async function () {
      await expect(bridge1.connect(alice).deposit(alice.address, 2, lowAmount))
        .to.emit(bridge1, "Deposited");
    });
  });

  describe("Revoke", function () {

    beforeEach(async () => {
      depositId = await bridge1.connect(alice).callStatic.deposit(bob.address, 2, lowAmount);
      await bridge1.connect(alice).deposit(bob.address, 2, lowAmount);
    })

    it("Could not revoke before 1h", async function () {
      await expect(bridge1.connect(alice).revoke(depositId))
        .to.be.revertedWith("Deposit is still locked")
    });
    it("Could revoke after 1h", async function () {
      let aliceBalance = await bridge1.balanceOf(alice.address);
      await time.increaseTo(await time.latest() + 3600)
      await bridge1.connect(alice).revoke(depositId);
      expect(await bridge1.balanceOf(alice.address)).to.equal(aliceBalance.add(lowAmount));
    });

    it("Could not revoke after sending", async function () {
      let signature = await sign(admin, alice.address, 1, bob.address, 2, lowAmount, 0);
      await bridge1.send(depositId, signature);
      await expect(bridge1.connect(alice).revoke(depositId))
        .to.be.revertedWith("Deposit is already transferred or revoked")
    });

    it("Cant revoke twice", async function () {
      await time.increaseTo(await time.latest() + 3600)
      await bridge1.connect(alice).revoke(depositId);
      await expect(bridge1.connect(alice).revoke(depositId))
        .to.be.revertedWith("Deposit is already transferred or revoked")
    });
    it("Emits Revoked", async function () {
      await time.increaseTo(await time.latest() + 3600)
      await expect(bridge1.connect(alice).revoke(depositId))
        .to.emit(bridge1, "Revoked");
    });
  });

  describe("Send", function () {

    beforeEach(async () => {
      depositId = await bridge1.connect(alice).callStatic.deposit(bob.address, 2, lowAmount);
      await bridge1.connect(alice).deposit(bob.address, 2, lowAmount);
    })

    it("Sending changes status of depositId", async function () {
      signature = await sign(admin, alice.address, 1, bob.address, 2, lowAmount, 0);
      await bridge1.send(depositId, signature);
      expect((await bridge1.deposits(depositId)).status).to.equal(SENT);
      // await bridge2.withdraw(alice.address, 1, bob.address, sendAmount, 0, signature);
    });
  });

  describe("Withdraw", function () {

    beforeEach(async () => {
      depositId = await bridge1.connect(alice).callStatic.deposit(bob.address, 2, lowAmount);
      await bridge1.connect(alice).deposit(bob.address, 2, lowAmount);
      signature = await sign(admin, alice.address, 1, bob.address, 2, lowAmount, 0);
      await bridge1.send(depositId, signature);
    })

    it("Withdraw with random signature fails", async function () {
      signature = await sign(admin, alice.address, 2, bob.address, 1, lowAmount, 0);
      await expect(bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 0, signature))
        .to.be.revertedWith("Invalid signature");
    });
    it("Could withdraw", async function () {
      expect(await bridge2.balanceOf(bob.address)).to.equal(0);
      await bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 0, signature);
      expect(await bridge2.balanceOf(bob.address)).to.equal(lowAmount);
    });
    it("Withdraw emits event", async function () {
      await expect(bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 0, signature))
        .to.emit(bridge2, "Withdrawed");
    });
    it("Could not withdraw twice", async function () {
      await bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 0, signature);
      await expect(bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 0, signature))
        .to.be.revertedWith("This deposit is already withdrawed");
    });
    it("Could withdraw in random order", async function () {
      depositId2 = await bridge1.connect(alice).callStatic.deposit(bob.address, 2, lowAmount);
      signature2 = await sign(admin, alice.address, 1, bob.address, 2, lowAmount, 1);
      await bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 1, signature2);
      await bridge2.withdraw(alice.address, 1, bob.address, lowAmount, 0, signature);
      expect(await bridge2.balanceOf(bob.address)).to.equal(lowAmount.mul(2));
    });
  });

  describe("Buy and collect", function () {
    it("Could buy", async function () {
      expect(await bridge1.balanceOf(bob.address)).to.equal(0);
      await bridge1.connect(bob).buy({value: await ethers.utils.parseEther("1.0")});
      expect(await bridge1.balanceOf(bob.address)).to.equal(await ethers.utils.parseUnits("1000", 18));
    });
    it("Could collect", async function () {
      balance1 = await admin.getBalance();
      await bridge1.connect(bob).buy({value: await ethers.utils.parseEther("1.0")});
      await bridge1.collect();
      balance2 = await admin.getBalance();
      expect(balance2.sub(balance1)).to.above(0);
    });
  });

});
