// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract BToken is ERC20 {
    constructor() ERC20("Bridge Token", "bTKN") {
        _mint(msg.sender, 10**24);
        _mint(address(this), 10**24);
    }

    function buy() external payable {
        uint256 value = msg.value;
        _mint(msg.sender, value * 10**3);
    }
}
