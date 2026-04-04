// ─────────────────────────────────────────────────────────────
//  SWEVOT  –  Contract Configuration
//  After deploying VotingSystem.sol to Sepolia, paste the address below.
// ─────────────────────────────────────────────────────────────

const CONTRACT_ADDRESS = 'YOUR_CONTRACT_ADDRESS_HERE';

const SEPOLIA = {
  chainId:            '0xaa36a7',   // 11155111 decimal
  chainName:          'Sepolia Test Network',
  rpcUrls:            ['https://rpc.sepolia.org'],
  blockExplorerUrls:  ['https://sepolia.etherscan.io'],
  nativeCurrency:     { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 }
};

// Human-readable ABI for ethers.js v6
const ABI = [
  // ── view ──
  'function admin() view returns (address)',
  'function totalVotes() view returns (uint256)',
  'function isElectionLive() view returns (bool)',
  'function candidateCount() view returns (uint256)',
  'function lookupByAadhaar(bytes32 _hash) view returns (address)',
  `function getCandidates() view returns (
      tuple(
        uint256 id, string name, string party, string emoji,
        address wallet, uint256 voteCount, bool approved, uint256 registeredAt
      )[]
   )`,
  `function getVoter(address _addr) view returns (
      tuple(
        bool registered, bool hasVoted, uint256 votedFor,
        bytes32 aadhaarHash, string name, string constituency, uint256 registeredAt
      )
   )`,
  `function getElection() view returns (
      tuple(string title, uint256 startTime, uint256 endTime, bool exists)
   )`,
  // ── write ──
  'function registerVoter(string _name, string _constituency, bytes32 _aadhaarHash)',
  'function registerCandidate(string _name, string _party, string _emoji)',
  'function approveCandidate(uint256 _id)',
  'function addCandidateByAdmin(string _name, string _party, string _emoji, address _wallet)',
  'function castVote(uint256 _candidateId)',
  'function createElection(string _title, uint256 _startTime, uint256 _endTime)',
  'function endElection()',
  'function transferAdmin(address _new)',
  // ── events ──
  'event VoterRegistered(address indexed voter, string name, string constituency)',
  'event CandidateSubmitted(uint256 indexed id, string name, string party, address wallet)',
  'event CandidateApproved(uint256 indexed id)',
  'event VoteCast(address indexed voter, uint256 indexed candidateId, uint256 timestamp)',
  'event ElectionCreated(string title, uint256 start, uint256 end)',
  'event ElectionEnded()'
];
