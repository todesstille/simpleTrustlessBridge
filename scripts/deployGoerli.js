const hre = require("hardhat");

async function main() {
  const Bridge = await hre.ethers.getContractFactory("Bridge");
  const bridge = await Bridge.deploy(5);
  await bridge.deployed();

  console.log(
    "Goerli address:", bridge.address
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});