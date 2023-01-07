// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BToken is ERC20 {
    constructor() ERC20("Bridge Token", "BTOKEN") {}

    // Debug purposes
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
