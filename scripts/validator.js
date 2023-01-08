require("dotenv/config");
const ethers = require("ethers");
const provider = ethers.getDefaultProvider(process.env.GOERLI_PROVIDER);
const mumbaiProvider = ethers.getDefaultProvider(process.env.MUMBAI_PROVIDER);
const wallet = new ethers.Wallet(process.env.PRIVATEKEY, provider);
const mumbaiWallet = new ethers.Wallet(process.env.PRIVATEKEY, mumbaiProvider);
const abiCoder = new ethers.utils.AbiCoder();

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

(async () => {
    let BridgeArtifact = require("../artifacts/contracts/Bridge.sol/Bridge.json");
    let BridgeAbi = BridgeArtifact.abi;
    let bridgeGoerli = await new ethers.Contract(process.env.GOERLI_ADDRESS, BridgeAbi, wallet);
    let bridgeMumbai = await new ethers.Contract(process.env.MUMBAI_ADDRESS, BridgeAbi, mumbaiWallet);
    let filter = {
        address: process.env.GOERLI_ADDRESS,
        topics:[ethers.utils.id("Deposited(address,uint256,address,uint256,uint256,uint256,bytes32)")]
    }
    provider.on(filter, async (event) => {
        let deposit = abiCoder.decode(["address from", "uint256 fromChain", "address to", "uint256 toChain", "uint256 amount", "uint256 nonce", "bytes32 depositId", ], event.data)
        let transferSignature = await sign(wallet, deposit.from, deposit.fromChain, deposit.to, deposit.toChain, deposit.amount, deposit.nonce);
        let tx = await bridgeGoerli.send(deposit.depositId, transferSignature);
        await tx.wait();
        tx = await bridgeMumbai.withdraw(deposit.from, deposit.fromChain, deposit.to, deposit.amount, deposit.nonce, transferSignature);
        await tx.wait();
    })
})();