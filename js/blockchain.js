// ─────────────────────────────────────────────────────────────
//  SWEVOT  –  Blockchain Layer
//  Requires: ethers.js v6 (CDN), js/config.js
// ─────────────────────────────────────────────────────────────

const BC = (() => {

  const PLACEHOLDER = 'YOUR_CONTRACT_ADDRESS_HERE';

  let _provider = null;
  let _signer   = null;
  let _contract = null;
  let _address  = null;

  /* ── internal helpers ── */

  function _initContract(signerOrProvider) {
    if (CONTRACT_ADDRESS === PLACEHOLDER) return null;
    return new ethers.Contract(CONTRACT_ADDRESS, ABI, signerOrProvider);
  }

  async function _ensureSepolia() {
    try {
      const chainId = await _provider.send('eth_chainId', []);
      if (chainId.toLowerCase() === SEPOLIA.chainId.toLowerCase()) return; // already correct
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA.chainId }]
      });
    } catch (e) {
      if (e.code === 4902 || (e.data?.originalError?.code === 4902)) {
        // Chain not in wallet yet – add it
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [SEPOLIA]
        });
      } else if (e.code === 4001) {
        throw new Error('Please switch to the Sepolia network in MetaMask.');
      }
      // Swallow other errors (race conditions, already switching, etc.)
    }
  }

  function _requireContract() {
    if (CONTRACT_ADDRESS === PLACEHOLDER)
      throw new Error('Contract not deployed yet — see DEPLOY.md, then paste the address into js/config.js');
    if (!_contract) throw new Error('Wallet not connected. Please refresh the page and connect.');
  }

  /* ─────── PUBLIC API ─────── */

  /** Connect MetaMask → Sepolia → return checksummed wallet address */
  async function connect() {
    if (!window.ethereum) throw new Error('MetaMask not detected.');
    _provider = new ethers.BrowserProvider(window.ethereum);

    // Request accounts (triggers MetaMask popup)
    try {
      await _provider.send('eth_requestAccounts', []);
    } catch (e) {
      if (e.code === 4001) throw new Error('Connection rejected — please approve in MetaMask.');
      throw e;
    }

    // Switch to Sepolia if needed
    await _ensureSepolia();

    // getSigner + getAddress gives the reliable checksummed address
    _signer   = await _provider.getSigner();
    _address  = await _signer.getAddress();
    _contract = _initContract(_signer);
    localStorage.setItem('swevot_wallet', _address.toLowerCase());
    return _address;
  }

  /** Silent reconnect (no MetaMask popup) – returns address or null */
  async function reconnect() {
    if (!window.ethereum) return null;
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts || !accounts.length) return null;
      _provider = new ethers.BrowserProvider(window.ethereum);
      _signer   = await _provider.getSigner();
      _address  = await _signer.getAddress();
      _contract = _initContract(_signer);
      return _address;
    } catch {
      return null; // silently fail – pages handle the null case
    }
  }

  /* ── voter ── */

  async function getVoter(addr) {
    _requireContract();
    return await _contract.getVoter(addr || _address);
  }

  async function registerVoter(name, constituency, aadhaar) {
    _requireContract();
    const hash = hashAadhaar(aadhaar);
    const tx   = await _contract.registerVoter(name, constituency, hash);
    return await tx.wait();
  }

  /** Returns true if the entered aadhaar matches the on-chain hash for connected wallet */
  async function verifyAadhaar(aadhaar) {
    _requireContract();
    const hash  = hashAadhaar(aadhaar);
    const voter = await _contract.getVoter(_address);
    return voter.aadhaarHash.toLowerCase() === hash.toLowerCase();
  }

  /* ── candidates ── */

  async function getCandidates() {
    _requireContract();
    return await _contract.getCandidates();
  }

  async function registerCandidate(name, party, emoji) {
    _requireContract();
    const tx = await _contract.registerCandidate(name, party, emoji);
    return await tx.wait();
  }

  async function approveCandidate(id) {
    _requireContract();
    const tx = await _contract.approveCandidate(id);
    return await tx.wait();
  }

  async function addCandidateByAdmin(name, party, emoji, wallet) {
    _requireContract();
    const tx = await _contract.addCandidateByAdmin(name, party, emoji, wallet || _address);
    return await tx.wait();
  }

  /* ── voting ── */

  async function castVote(candidateId) {
    _requireContract();
    const tx = await _contract.castVote(candidateId);
    return await tx.wait();
  }

  /* ── election ── */

  async function getElection() {
    _requireContract();
    return await _contract.getElection();
  }

  async function isElectionLive() {
    _requireContract();
    return await _contract.isElectionLive();
  }

  async function getTotalVotes() {
    _requireContract();
    return Number(await _contract.totalVotes());
  }

  /* ── admin ── */

  async function isAdmin() {
    if (!_contract || !_address) return false;
    try {
      const a = await _contract.admin();
      return a.toLowerCase() === _address.toLowerCase();
    } catch { return false; }
  }

  async function createElection(title, startTs, endTs) {
    _requireContract();
    const tx = await _contract.createElection(title, BigInt(startTs), BigInt(endTs));
    return await tx.wait();
  }

  async function endElectionNow() {
    _requireContract();
    const tx = await _contract.endElection();
    return await tx.wait();
  }

  /* ── utils ── */

  function hashAadhaar(raw) {
    const digits = raw.replace(/\D/g, '');
    return ethers.keccak256(ethers.toUtf8Bytes(digits));
  }

  function shortAddr(addr) {
    if (!addr) return '';
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function isDeployed() {
    return CONTRACT_ADDRESS !== PLACEHOLDER;
  }

  function getSavedWallet() {
    return localStorage.getItem('swevot_wallet');
  }

  function clearSession() {
    localStorage.removeItem('swevot_wallet');
  }

  /* ── expose ── */
  return {
    connect, reconnect,
    getVoter, registerVoter, verifyAadhaar,
    getCandidates, registerCandidate, approveCandidate, addCandidateByAdmin,
    castVote,
    getElection, isElectionLive, getTotalVotes,
    isAdmin, createElection, endElectionNow,
    hashAadhaar, shortAddr, isDeployed,
    getSavedWallet, clearSession,
    get address() { return _address; }
  };
})();
