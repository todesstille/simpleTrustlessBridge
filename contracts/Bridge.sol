// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./BToken.sol";
import "./EIP712Bridge.sol";

contract Bridge is BToken, EIP712Bridge {

    enum DepositStatus {PENDING, SENT, REVOKED}

    struct Deposit {
        address from;
        uint256 fromChain;
        address to;
        uint256 toChain;
        uint256 amount;
        uint256 nonce;
        uint256 time;
        DepositStatus status;
    }

    uint256 constant lockTime = 1 hours;
    // Finality time for this blockchain. MUST be lesser than lockTime. Later will be set in constructor
    uint256 constant finalityTime = 30 minutes;

    address public validator;
    uint256 public chainId;
    mapping(address => mapping (uint256 => mapping (uint256 => uint256))) nonces;
    mapping(bytes32 => Deposit) public deposits;

    event Deposited (bytes32 depositId);
    event Withdrawed (bytes32 depositId);

    constructor(address validator_, uint256 chainId_) EIP712Bridge("Trustless Bridge", "0.1") {
        validator = validator_;
        chainId = chainId_;
    }

    function _deposit(address from, address to, uint256 toChain, uint256 amount) internal {
        require(toChain != chainId, "Source chain is the same as destination chain. Just use transfer");
        uint256 nonce = nonces[from][chainId][toChain];
        bytes32 depositId = keccak256(abi.encodePacked(from, chainId, to, toChain, amount, nonce));
        Deposit memory deposit_ = Deposit (from, chainId, to, toChain, amount, nonce, block.timestamp, DepositStatus.PENDING);
        deposits[depositId] = deposit_;
        nonces[from][chainId][toChain] += 1;
        emit Deposited(depositId);
    }

    function deposit(address to, uint256 toChain, uint256 amount) external {
        // Debug function. It implies that user already transfer BTokens on contract
        _deposit(msg.sender, to, toChain, amount);
    }

    function revoke(bytes32 depositId) external {
        Deposit storage deposit_ = deposits[depositId];
        require(msg.sender == deposit_.from, "You are not the deposit owner");
        require(deposit_.status == DepositStatus.PENDING, "Deposit is already transferred or revoked");
        require(deposit_.time + lockTime <= block.timestamp, "Deposit is still locked");
        transfer(msg.sender, deposit_.amount);
        deposit_.status = DepositStatus.REVOKED;
        emit Withdrawed(depositId);
    }

    function getDigest(address from, uint256 fromChain, address to, uint256 toChain, uint256 amount, uint256 nonce) 
            public view returns (bytes32) {
        bytes32 digest = _hashTypedData(keccak256(abi.encode(
            keccak256("Deposit(address from,uint256 fromChain,address to,uint256 toChain,uint256 amount,uint256 nonce)"),
            from,
            fromChain,
            to,
            toChain,
            amount,
            nonce
        )));
        return digest;
    }

    function send(bytes32 depositId, bytes memory signature) external {
        Deposit storage deposit_ = deposits[depositId];
        require(deposit_.time + lockTime - finalityTime <= block.timestamp, "Too late to transfer");
        bytes32 digest = getDigest(
            deposit_.from,
            chainId,
            deposit_.to,
            deposit_.toChain,
            deposit_.amount,
            deposit_.nonce
        );
        address signer = ECDSA.recover(digest, signature);
        require (signer == validator, "You are not the Validator");
        deposit_.status = DepositStatus.SENT;
    }
}
