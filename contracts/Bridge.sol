// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import "./BToken.sol";
import "./EIP712Bridge.sol";
//import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract Bridge is BToken, EIP712Bridge {

    enum DepositStatus {NONEXISTENT, PENDING, SENT, REVOKED}

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
    // This scheme could result in stacking nonces. Rewrite.
    mapping(address => mapping (uint256 => mapping (uint256 => uint256))) nonces;
    mapping(bytes32 => Deposit) public deposits;
    mapping(address => mapping (uint256 => mapping (uint256 => uint256))) usedNonces;

    event Deposited (bytes32 depositId);
    event Withdrawed (bytes32 depositId);

    constructor(address validator_, uint256 chainId_) EIP712Bridge("Trustless Bridge", "0.1") {
        validator = validator_;
        chainId = chainId_;
    }

    function _deposit(address from, address to, uint256 toChain, uint256 amount) internal returns (bytes32) {
        require(toChain != chainId, "Source chain is the same as destination chain. Just use transfer");
        uint256 nonce = nonces[from][chainId][toChain];
        bytes32 depositId = keccak256(abi.encodePacked(from, chainId, to, toChain, amount, nonce));
        Deposit memory deposit_ = Deposit (from, chainId, to, toChain, amount, nonce, block.timestamp, DepositStatus.PENDING);
        deposits[depositId] = deposit_;
        nonces[from][chainId][toChain] += 1;
        emit Deposited(depositId);
        return depositId;
    }

    function deposit(address to, uint256 toChain, uint256 amount) external returns (bytes32) {
        // Debug function. It implies that user already transfer BTokens on contract
        return _deposit(msg.sender, to, toChain, amount);
    }

    function revoke(bytes32 depositId) external {
        Deposit storage deposit_ = deposits[depositId];
        require(msg.sender == deposit_.from, "You are not the deposit owner");
        require(deposit_.status == DepositStatus.PENDING, "Deposit is already transferred or revoked");
        require(deposit_.time + lockTime <= block.timestamp, "Deposit is still locked");
        _transfer(address(this), msg.sender, deposit_.amount);
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
        require(deposit_.time + lockTime - finalityTime >= block.timestamp, "Too late to transfer");
        require(deposit_.status == DepositStatus.PENDING, "Wrong deposit status");
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

    function withdraw(address from, uint256 chainFrom, address to, uint256 amount, uint256 nonce, bytes memory signature) external {
        uint256 base = usedNonces[from][chainFrom][nonce / 256];
        require (((base >> (nonce % 256)) % 2) == 0, "This deposit is already withdrawed");
        base += (1 << (nonce % 256));
        usedNonces[from][chainFrom][nonce / 256] = base;
        
        bytes32 digest = getDigest(
            from,
            chainFrom,
            to,
            chainId,
            amount,
            nonces[from][chainFrom][chainId]
        );
        address signer = ECDSA.recover(digest, signature);
        require (signer == validator, "Invalid signature");
        require(chainFrom != chainId, "Something nasty happened");
        _transfer(address(this), to, amount);
        nonces[from][chainFrom][chainId] += 1;
    }
    function getChainId() public view returns (uint256) {
        return block.chainid;
    }
}
