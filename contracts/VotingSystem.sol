// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title  SWEVOT – Secure Web-based e-Voting System
 * @notice Deploy on Sepolia Testnet, then paste the address into js/config.js
 * @dev    One wallet = one voter.  One voter = one vote.
 *         Aadhaar is stored as keccak256 hash for on-chain privacy.
 */
contract SWEVOT {

    /* ══════════════ STRUCTS ══════════════ */

    struct Voter {
        bool     registered;
        bool     hasVoted;
        uint256  votedFor;      // candidate index; type(uint256).max = not voted
        bytes32  aadhaarHash;   // keccak256(raw 12-digit aadhaar string)
        string   name;
        string   constituency;
        uint256  registeredAt;
    }

    struct Candidate {
        uint256 id;
        string  name;
        string  party;
        string  emoji;          // party symbol
        address wallet;
        uint256 voteCount;
        bool    approved;
        uint256 registeredAt;
    }

    struct Election {
        string  title;
        uint256 startTime;
        uint256 endTime;
        bool    exists;
    }

    /* ══════════════ STATE ══════════════ */

    address     public admin;
    Election    public currentElection;
    Candidate[] private _candidates;
    uint256     public totalVotes;

    mapping(address => Voter)   public voters;
    mapping(bytes32 => bool)    public usedAadhaarHash;
    mapping(bytes32 => address) public aadhaarToWallet;

    /* ══════════════ EVENTS ══════════════ */

    event VoterRegistered   (address indexed voter, string name, string constituency);
    event CandidateSubmitted(uint256 indexed id, string name, string party, address wallet);
    event CandidateApproved (uint256 indexed id);
    event VoteCast          (address indexed voter, uint256 indexed candidateId, uint256 timestamp);
    event ElectionCreated   (string title, uint256 start, uint256 end);
    event ElectionEnded     ();
    event AdminTransferred  (address oldAdmin, address newAdmin);

    /* ══════════════ MODIFIERS ══════════════ */

    modifier onlyAdmin() {
        require(msg.sender == admin, "SWEVOT: not admin");
        _;
    }

    modifier onlyRegistered() {
        require(voters[msg.sender].registered, "SWEVOT: not registered");
        _;
    }

    modifier duringElection() {
        require(currentElection.exists,                       "SWEVOT: no election");
        require(block.timestamp >= currentElection.startTime, "SWEVOT: not started");
        require(block.timestamp <= currentElection.endTime,   "SWEVOT: election ended");
        _;
    }

    /* ══════════════ CONSTRUCTOR ══════════════ */

    constructor() {
        admin = msg.sender;
        currentElection = Election({
            title:     "National Election 2026: Parliamentary Seat",
            startTime: block.timestamp,
            endTime:   block.timestamp + 365 days,
            exists:    true
        });
    }

    /* ══════════════ VOTER ══════════════ */

    /**
     * @notice Register as a voter.  Aadhaar hash must be unique.
     * @param _aadhaarHash  ethers.keccak256(ethers.toUtf8Bytes(raw12digits))  – computed client-side
     */
    function registerVoter(
        string  calldata _name,
        string  calldata _constituency,
        bytes32          _aadhaarHash
    ) external {
        require(!voters[msg.sender].registered,  "SWEVOT: already registered");
        require(!usedAadhaarHash[_aadhaarHash],  "SWEVOT: Aadhaar already linked");

        voters[msg.sender] = Voter({
            registered:   true,
            hasVoted:     false,
            votedFor:     type(uint256).max,
            aadhaarHash:  _aadhaarHash,
            name:         _name,
            constituency: _constituency,
            registeredAt: block.timestamp
        });

        usedAadhaarHash[_aadhaarHash]  = true;
        aadhaarToWallet[_aadhaarHash]  = msg.sender;

        emit VoterRegistered(msg.sender, _name, _constituency);
    }

    /* ══════════════ CANDIDATES ══════════════ */

    /// @notice Registered voter self-nominates. Admin gets auto-approved.
    function registerCandidate(
        string calldata _name,
        string calldata _party,
        string calldata _emoji
    ) external onlyRegistered {
        for (uint256 i = 0; i < _candidates.length; i++) {
            require(_candidates[i].wallet != msg.sender, "SWEVOT: already a candidate");
        }
        uint256 id = _candidates.length;
        bool auto_ = (msg.sender == admin);

        _candidates.push(Candidate({
            id:           id,
            name:         _name,
            party:        _party,
            emoji:        _emoji,
            wallet:       msg.sender,
            voteCount:    0,
            approved:     auto_,
            registeredAt: block.timestamp
        }));

        emit CandidateSubmitted(id, _name, _party, msg.sender);
        if (auto_) emit CandidateApproved(id);
    }

    /// @notice Admin directly adds a pre-approved candidate.
    function addCandidateByAdmin(
        string  calldata _name,
        string  calldata _party,
        string  calldata _emoji,
        address          _wallet
    ) external onlyAdmin {
        uint256 id = _candidates.length;
        _candidates.push(Candidate({
            id:           id,
            name:         _name,
            party:        _party,
            emoji:        _emoji,
            wallet:       _wallet,
            voteCount:    0,
            approved:     true,
            registeredAt: block.timestamp
        }));
        emit CandidateSubmitted(id, _name, _party, _wallet);
        emit CandidateApproved(id);
    }

    /// @notice Admin approves a self-registered candidate.
    function approveCandidate(uint256 _id) external onlyAdmin {
        require(_id < _candidates.length, "SWEVOT: invalid id");
        _candidates[_id].approved = true;
        emit CandidateApproved(_id);
    }

    /* ══════════════ VOTING ══════════════ */

    /// @notice Cast exactly one vote. Enforced on-chain.
    function castVote(uint256 _candidateId) external onlyRegistered duringElection {
        require(!voters[msg.sender].hasVoted,           "SWEVOT: already voted");
        require(_candidateId < _candidates.length,      "SWEVOT: invalid candidate");
        require(_candidates[_candidateId].approved,     "SWEVOT: candidate not approved");

        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedFor = _candidateId;
        _candidates[_candidateId].voteCount++;
        totalVotes++;

        emit VoteCast(msg.sender, _candidateId, block.timestamp);
    }

    /* ══════════════ VIEW ══════════════ */

    function getCandidates() external view returns (Candidate[] memory) { return _candidates; }
    function getVoter(address _addr) external view returns (Voter memory) { return voters[_addr]; }
    function getElection() external view returns (Election memory) { return currentElection; }
    function candidateCount() external view returns (uint256) { return _candidates.length; }

    function isElectionLive() external view returns (bool) {
        return currentElection.exists
            && block.timestamp >= currentElection.startTime
            && block.timestamp <= currentElection.endTime;
    }

    function lookupByAadhaar(bytes32 _hash) external view returns (address) {
        return aadhaarToWallet[_hash];
    }

    /* ══════════════ ADMIN ══════════════ */

    function createElection(
        string  calldata _title,
        uint256          _startTime,
        uint256          _endTime
    ) external onlyAdmin {
        require(_endTime > _startTime, "SWEVOT: invalid range");
        currentElection = Election({ title: _title, startTime: _startTime, endTime: _endTime, exists: true });
        emit ElectionCreated(_title, _startTime, _endTime);
    }

    function endElection() external onlyAdmin {
        currentElection.endTime = block.timestamp;
        emit ElectionEnded();
    }

    function transferAdmin(address _new) external onlyAdmin {
        require(_new != address(0), "SWEVOT: zero addr");
        emit AdminTransferred(admin, _new);
        admin = _new;
    }
}
