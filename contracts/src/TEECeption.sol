// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TEECeption {
    address public owner;
    address public agent;
    address public donee;

    uint64 public matchTimestamp;
    uint64 public matchDuration;

    uint64 public protocolCut;
    uint64 public constant PROTOCOL_CUT_DENOMINATOR = 10000;

    event MatchStarted(uint64 timestamp, address indexed donee);
    event MatchDurationSet(uint64 duration);
    event AgentSet(address indexed agent);
    event ProtocolCutSet(uint64 cut);
    event Donated(address indexed donee, uint256 amount);
    event Drained(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _transferOwnership(msg.sender);

        matchDuration = 8 hours;
        protocolCut = 5 * PROTOCOL_CUT_DENOMINATOR / 100;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "TEECeption: Sender is not the owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "TEECeption: Sender is not the agent");
        _;
    }

    modifier matchActive() {
        require(
            matchTimestamp > 0 && matchTimestamp + matchDuration > uint64(block.timestamp),
            "TEECeption: Match is not active"
        );
        _;
    }

    modifier matchNotActive() {
        require(
            matchTimestamp == 0 || matchTimestamp + matchDuration <= uint64(block.timestamp),
            "TEECeption: Match is active"
        );
        _;
    }

    function setAgent(address newAgent) external onlyOwner matchNotActive {
        agent = newAgent;
        emit AgentSet(agent);
    }

    function setMatchDuration(uint64 duration) external onlyOwner matchNotActive {
        matchDuration = duration;
        emit MatchDurationSet(matchDuration);
    }

    function setProtocolCut(uint64 newCut) external onlyOwner matchNotActive {
        require(newCut <= PROTOCOL_CUT_DENOMINATOR, "TEECeption: Cut cannot exceed 100%");
        protocolCut = newCut;
        emit ProtocolCutSet(protocolCut);
    }

    function startMatch(address _donee) external onlyOwner matchNotActive {
        _withdrawPool(_donee);

        matchTimestamp = uint64(block.timestamp);
        donee = _donee;

        emit MatchStarted(matchTimestamp, donee);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        _transferOwnership(newOwner);
    }

    function drain(address to) external matchActive onlyAgent {
        emit Drained(to, _withdrawPool(to));
    }

    function donate() external matchNotActive {
        emit Donated(donee, _withdrawPool(donee));
    }

    function sweep(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    function _transferOwnership(address newOwner) internal {
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function _withdrawPool(address to) internal returns (uint256) {
        (uint256 fee, uint256 output) = _getPool();

        if (fee > 0) {
            payable(owner).transfer(fee);
        }

        if (output > 0) {
            payable(to).transfer(output);
        }

        return output;
    }

    function _getPool() internal view returns (uint256 fee, uint256 output) {
        uint256 balance = address(this).balance;

        fee = (balance * uint256(protocolCut)) / uint256(PROTOCOL_CUT_DENOMINATOR);
        output = balance - fee;
    }

    receive() external payable {}
}
