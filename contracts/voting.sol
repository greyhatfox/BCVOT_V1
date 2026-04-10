// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Voting {
    struct Candidate {
        uint id;
        string name;
        string party;
        uint voteCount;
    }

    struct Election {
        uint id;
        string title;
        bool isActive;
        uint endTime;
    }

    address public admin;
    mapping(uint => Election) public elections;
    mapping(uint => Candidate[]) public electionCandidates;
    mapping(uint => mapping(address => bool)) public hasVoted;
    mapping(address => bool) public registeredVoters;

    uint public electionCount;

    event VoteCast(uint indexed electionId, address indexed voter, uint candidateId, uint timestamp);
    event ElectionCreated(uint indexed electionId, string title);
    event VoterRegistered(address indexed voter);

    modifier onlyAdmin() { require(msg.sender == admin, "Not admin"); _; }
    modifier onlyRegistered() { require(registeredVoters[msg.sender], "Not registered"); _; }

    constructor() { admin = msg.sender; }

    function registerVoter(address voter) external onlyAdmin {
        registeredVoters[voter] = true;
        emit VoterRegistered(voter);
    }

    function selfRegister() external {
        require(!registeredVoters[msg.sender], "Already registered");
        registeredVoters[msg.sender] = true;
        emit VoterRegistered(msg.sender);
    }

    function createElection(string memory title, uint durationInSeconds, string[] memory names, string[] memory parties) external onlyAdmin returns (uint) {
        electionCount++;
        elections[electionCount] = Election(electionCount, title, true, block.timestamp + durationInSeconds);
        for (uint i = 0; i < names.length; i++) {
            electionCandidates[electionCount].push(Candidate(i+1, names[i], parties[i], 0));
        }
        emit ElectionCreated(electionCount, title);
        return electionCount;
    }

    function castVote(uint electionId, uint candidateId) external onlyRegistered {
        Election storage election = elections[electionId];
        require(election.isActive, "Election not active");
        require(block.timestamp < election.endTime, "Election ended");
        require(!hasVoted[electionId][msg.sender], "Already voted");
        require(candidateId > 0 && candidateId <= electionCandidates[electionId].length, "Invalid candidate");

        hasVoted[electionId][msg.sender] = true;
        electionCandidates[electionId][candidateId - 1].voteCount++;

        emit VoteCast(electionId, msg.sender, candidateId, block.timestamp);
    }

    function getResults(uint electionId) external view returns (Candidate[] memory) {
        return electionCandidates[electionId];
    }

    function closeElection(uint electionId) external onlyAdmin {
        elections[electionId].isActive = false;
    }
}