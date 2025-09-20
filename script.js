// Professional Smart Barcode Scanner with Enhanced Features
class SmartBarcodeApp {
    constructor() {
        // Core application state
        this.isScanning = false;
        this.scanResult = null;
        this.products = [];
        this.scannedProducts = [];
        
        // Configuration and cache - استخدام مسار ثابت للملف
        this.config = {
            dataUrl: './sample_products.xlsx', // مسار ثابت بدلاً من رابط خارجي
            lastSync: localStorage.getItem('lastSyncTime') || null,
            autoSyncInterval: 5 * 60 * 1000, // 5 minutes
            cacheKey: 'barcodeAppData',
            versionKey: 'dataVersion'
        };
        
        // Voice recognition
        this.recognition = null;
        this.currentProduct = null;
        
        // Auto-sync timer
        this.syncTimer = null;
        
        // Camera flash support
        this.stream = null;
        this.flashEnabled = false;
        
        // Audio feedback
        this.audioContext = null;
        
        this.init();
    }

    async init() {
        console.log('🚀 بدء تشغيل التطبيق الذكي');
        
        // Register Service Worker
        if ('serviceWorker' in navigator) {
            await this.registerServiceWorker();
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize voice recognition
        this.initVoiceRecognition();
        
        // Initialize audio context for sound feedback
        this.initAudioContext();
        
        // Load cached data or setup data source (التحميل التلقائي)
        await this.loadCachedData();
        
        // Start auto-sync since we have a fixed data source
        this.startAutoSync();
        
        console.log('✅ التطبيق جاهز للاستخدام');
    }

    async registerServiceWorker() {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker مسجل بنجاح:', registration);
        } catch (error) {
            console.error('❌ خطأ في تسجيل Service Worker:', error);
        }
    }

    setupEventListeners() {
        // Camera controls
        document.getElementById('startCamera').addEventListener('click', () => this.startCamera());
        document.getElementById('stopCamera').addEventListener('click', () => this.stopCamera());
        document.getElementById('toggleFlash').addEventListener('click', () => this.toggleFlash());
        
        // Confirmation controls (إزالة أزرار الصوت لأن العملية أصبحت تلقائية)
        document.getElementById('confirmAdd').addEventListener('click', () => this.confirmAddProduct());
        document.getElementById('cancelAdd').addEventListener('click', () => this.cancelAddProduct());
        
        // Data management - إزالة إعداد الرابط لأنه أصبح ثابت
        document.getElementById('refreshData').addEventListener('click', () => this.manualRefresh());
        document.getElementById('updateNow').addEventListener('click', () => this.updateData());
        document.getElementById('dismissUpdate').addEventListener('click', () => this.dismissUpdate());
        
        // Export and Delete All functionality
        document.getElementById('exportData').addEventListener('click', () => this.exportToExcel());
        document.getElementById('deleteAll').addEventListener('click', () => this.showDeleteAllConfirmation());
        
        // Delete confirmation modal
        document.getElementById('confirmDeleteAll').addEventListener('click', () => this.confirmDeleteAll());
        document.getElementById('cancelDeleteAll').addEventListener('click', () => this.hideDeleteAllConfirmation());
    }

    initVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.lang = 'ar-EG';
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onresult = (event) => this.handleVoiceResult(event);
            this.recognition.onerror = (event) => this.handleVoiceError(event);
            this.recognition.onend = () => this.onVoiceEnd();
            
            console.log('✅ التعرف على الصوت متاح');
        } else {
            console.warn('⚠️ التعرف على الصوت غير مدعوم');
            this.showStatus('التعرف على الصوت غير مدعوم في هذا المتصفح', 'error');
        }
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('✅ السياق الصوتي جاهز');
        } catch (error) {
            console.warn('⚠️ فشل في إنشاء السياق الصوتي:', error);
        }
    }

    async playSuccessSound(productName) {
        // إنشاء نبرة صوتية للنجاح
        if (this.audioContext) {
            try {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.value = 880; // نبرة إيجابية
                oscillator.type = 'sine';
                
                gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.5);
            } catch (error) {
                console.warn('فشل في تشغيل الصوت:', error);
            }
        }
        
        // تشغيل صوت نصي باستخدام تقنية Web Speech API
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`تم العثور على ${productName}، أدخل الكمية`);
            utterance.lang = 'ar-SA';
            utterance.rate = 1.2;
            utterance.pitch = 1.1;
            speechSynthesis.speak(utterance);
        }
    }

    async loadCachedData() {
        this.updateStatus('loading', '⏳', 'جاري التحقق من البيانات المحفوظة...');
        
        try {
            // Load from localStorage first
            const cachedData = localStorage.getItem(this.config.cacheKey);
            
            if (cachedData) {
                const data = JSON.parse(cachedData);
                this.products = data.products || [];
                this.scannedProducts = data.scannedProducts || [];
                
                this.updateStatus('success', '✅', `تم تحميل ${this.products.length} منتج من الذاكرة المحلية`);
                this.updateDataStats();
                this.renderScannedProducts();
                
                // Check for updates if we have internet
                if (navigator.onLine) {
                    this.checkForUpdates();
                }
            } else {
                // No cached data, try to load from fixed path
                await this.loadDataFromUrl(true);
            }
        } catch (error) {
            console.error('خطأ في تحميل البيانات المحفوظة:', error);
            this.updateStatus('error', '❌', 'خطأ في تحميل البيانات المحفوظة');
        }
    }

    // تم إزالة setupDataSource لأن المسار أصبح ثابت

    async loadDataFromUrl(showProgress = false) {
        // استخدام المسار الثابت المحدد في الإعدادات
        if (showProgress) {
            this.updateStatus('loading', '⬇️', 'جاري تحميل البيانات من الملف المحلي...');
        }
        
        try {
            const response = await fetch(this.config.dataUrl, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            // Parse data (skip header row)
            this.products = [];
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (row[0] && row[1]) { // Must have code and name
                    this.products.push({
                        code: String(row[0]).trim(),
                        name: String(row[1]).trim(),
                        quantity: row[2] || 0
                    });
                }
            }
            
            // Save to cache
            await this.saveToCache();
            
            // Update version info
            const now = new Date().toISOString();
            localStorage.setItem(this.config.versionKey, now);
            localStorage.setItem('lastSyncTime', now);
            this.config.lastSync = now;
            
            this.updateStatus('success', '✅', `تم تحميل ${this.products.length} منتج بنجاح`);
            this.updateDataStats();
            this.updateSyncStatus();
            
            return true;
            
        } catch (error) {
            console.error('خطأ في تحميل البيانات:', error);
            
            if (!navigator.onLine) {
                this.updateStatus('offline', '📶', 'لا يوجد اتصال بالإنترنت - العمل من البيانات المحفوظة');
            } else {
                this.updateStatus('error', '❌', `خطأ في تحميل البيانات: ${error.message}`);
            }
            
            return false;
        }
    }

    async saveToCache() {
        try {
            const dataToCache = {
                products: this.products,
                scannedProducts: this.scannedProducts,
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(this.config.cacheKey, JSON.stringify(dataToCache));
            console.log('✅ تم حفظ البيانات في الذاكرة المحلية');
        } catch (error) {
            console.error('خطأ في حفظ البيانات:', error);
        }
    }

    async checkForUpdates() {
        if (!navigator.onLine) return;
        
        try {
            const response = await fetch(this.config.dataUrl, {
                method: 'HEAD',
                cache: 'no-cache'
            });
            
            if (response.ok) {
                const lastModified = response.headers.get('Last-Modified');
                const etag = response.headers.get('ETag');
                
                const currentVersion = localStorage.getItem(this.config.versionKey);
                const serverVersion = lastModified || etag || new Date().toISOString();
                
                if (currentVersion && serverVersion !== currentVersion) {
                    this.showUpdateNotification();
                }
            }
        } catch (error) {
            console.log('التحقق من التحديثات فشل (هذا عادي):', error.message);
        }
    }

    showUpdateNotification() {
        const notification = document.getElementById('update-notification');
        notification.classList.remove('hidden');
        
        // Auto-hide after 30 seconds
        setTimeout(() => {
            this.dismissUpdate();
        }, 30000);
    }

    dismissUpdate() {
        const notification = document.getElementById('update-notification');
        notification.classList.add('hidden');
    }

    async updateData() {
        this.dismissUpdate();
        await this.loadDataFromUrl(true);
        this.showStatus('تم تحديث البيانات بنجاح', 'success');
    }

    async manualRefresh() {
        await this.loadDataFromUrl(true);
    }

    startAutoSync() {
        // Clear existing timer
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        
        // Set up auto-sync every 5 minutes - since we have a fixed data source
        this.syncTimer = setInterval(() => {
            if (navigator.onLine) {
                console.log('🔄 فحص تلقائي للتحديثات...');
                this.checkForUpdates();
            }
        }, this.config.autoSyncInterval);
        
        console.log('✅ بدء المزامنة التلقائية');
    }

    updateStatus(type, icon, text) {
        const statusEl = document.getElementById('fileStatus');
        const iconEl = statusEl.querySelector('.status-icon');
        const textEl = statusEl.querySelector('.status-text');
        
        // Remove all status classes
        statusEl.className = 'file-status';
        statusEl.classList.add(type);
        
        if (iconEl && textEl) {
            iconEl.textContent = icon;
            textEl.textContent = text;
            
            // Add loading animation for loading state
            if (type === 'loading') {
                iconEl.classList.add('loading');
            } else {
                iconEl.classList.remove('loading');
            }
        } else {
            statusEl.innerHTML = `<div class="status-icon">${icon}</div><div class="status-text">${text}</div>`;
        }
    }

    updateDataStats() {
        const statsEl = document.getElementById('dataStats');
        
        if (this.products.length > 0) {
            statsEl.innerHTML = `
                <h4>📊 إحصائيات البيانات</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-number">${this.products.length}</span>
                        <span class="stat-label">إجمالي المنتجات</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-number">${this.scannedProducts.length}</span>
                        <span class="stat-label">منتجات ممسوحة</span>
                    </div>
                </div>
            `;
            statsEl.style.display = 'block';
        } else {
            statsEl.style.display = 'none';
        }
    }

    updateSyncStatus() {
        const syncEl = document.getElementById('syncStatus');
        const timeEl = document.getElementById('lastSyncTime');
        
        if (this.config.lastSync && timeEl) {
            const date = new Date(this.config.lastSync);
            timeEl.textContent = date.toLocaleString('ar-EG');
            syncEl.style.display = 'block';
        }
    }

    // Camera functionality with flash support
    async startCamera() {
        try {
            this.updateStatus('loading', '📷', 'جاري تشغيل الكاميرا...');
            
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    facingMode: 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            });
            
            const video = document.getElementById('video');
            video.srcObject = this.stream;
            
            // Check if flash is available
            const track = this.stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                document.getElementById('toggleFlash').style.display = 'inline-block';
                console.log('✅ الفلاش متاح');
            } else {
                document.getElementById('toggleFlash').style.display = 'none';
                console.log('⚠️ الفلاش غير متاح على هذا الجهاز');
            }
            
            document.getElementById('startCamera').style.display = 'none';
            document.getElementById('stopCamera').style.display = 'inline-block';
            
            // Start barcode scanning
            this.startBarcodeScanning();
            
            this.updateStatus('success', '👁️', 'الكاميرا تعمل - ابدأ بمسح الباركود');
            
        } catch (error) {
            console.error('خطأ في تشغيل الكاميرا:', error);
            this.updateStatus('error', '❌', 'خطأ في تشغيل الكاميرا');
        }
    }

    stopCamera() {
        const video = document.getElementById('video');
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            video.srcObject = null;
        }
        
        if (this.isScanning) {
            Quagga.stop();
            this.isScanning = false;
        }
        
        document.getElementById('startCamera').style.display = 'inline-block';
        document.getElementById('stopCamera').style.display = 'none';
        document.getElementById('toggleFlash').style.display = 'none';
        this.flashEnabled = false;
        
        this.updateStatus('offline', '📷', 'الكاميرا متوقفة');
    }

    async toggleFlash() {
        if (!this.stream) return;
        
        try {
            const track = this.stream.getVideoTracks()[0];
            const capabilities = track.getCapabilities();
            
            if (capabilities.torch) {
                this.flashEnabled = !this.flashEnabled;
                await track.applyConstraints({
                    advanced: [{ torch: this.flashEnabled }]
                });
                
                const flashBtn = document.getElementById('toggleFlash');
                if (this.flashEnabled) {
                    flashBtn.textContent = '🔦 إيقاف الفلاش';
                    flashBtn.classList.add('flash-on');
                } else {
                    flashBtn.textContent = '💡 تشغيل الفلاش';
                    flashBtn.classList.remove('flash-on');
                }
                
                console.log('🔦 تم تغيير حالة الفلاش:', this.flashEnabled);
            }
        } catch (error) {
            console.error('خطأ في التحكم بالفلاش:', error);
            this.showStatus('خطأ في التحكم بالفلاش', 'error');
        }
    }

    startBarcodeScanning() {
        Quagga.init({
            inputStream: {
                name: "Live",
                type: "LiveStream",
                target: document.querySelector('#video')
            },
            decoder: {
                readers: [
                    "code_128_reader",
                    "ean_reader",
                    "ean_8_reader",
                    "code_39_reader",
                    "code_39_vin_reader",
                    "codabar_reader",
                    "upc_reader",
                    "upc_e_reader"
                ]
            }
        }, (err) => {
            if (err) {
                console.error('خطأ في تشغيل Quagga:', err);
                this.updateStatus('error', '❌', 'خطأ في تشغيل مسح الباركود');
                return;
            }
            
            Quagga.start();
            this.isScanning = true;
            console.log('✅ بدء مسح الباركود');
        });

        Quagga.onDetected((result) => {
            if (result && result.codeResult) {
                this.handleBarcodeDetected(result.codeResult.code);
            }
        });
    }

    handleBarcodeDetected(code) {
        console.log('🔍 تم رصد باركود:', code);
        this.scanResult = code;
        
        // Stop scanning temporarily
        Quagga.stop();
        this.isScanning = false;
        
        // Find product in database
        const product = this.products.find(p => p.code === code);
        
        if (product) {
            this.currentProduct = { ...product };
            
            // تشغيل الصوت التلقائي عند العثور على المنتج
            this.playSuccessSound(product.name);
            
            // الانتقال التلقائي لإدخال الكمية بدلاً من إظهار قسم الصوت
            this.autoStartQuantityInput();
            
            this.updateStatus('success', '✅', `تم العثور على المنتج: ${product.name}`);
        } else {
            this.showStatus(`كود غير معروف: ${code}`, 'error');
            // Restart scanning after 3 seconds
            setTimeout(() => {
                if (!this.isScanning) {
                    this.startBarcodeScanning();
                }
            }, 3000);
        }
    }

    // طريقة جديدة للانتقال التلقائي لإدخال الكمية
    autoStartQuantityInput() {
        // إخفاء قسم الصوت إذا كان ظاهراً
        this.hideVoiceSection();
        
        // بدء التعرف على الصوت مباشرة
        if (this.recognition) {
            this.startVoiceRecognition();
        } else {
            // إذا لم يكن التعرف على الصوت متاح، اعرض حقل إدخال نصي
            this.showQuantityInputFallback();
        }
    }

    // طريقة بديلة لإدخال الكمية نصياً
    showQuantityInputFallback() {
        const quantityInput = document.getElementById('quantityInputFallback');
        const productNameDisplay = document.getElementById('productNameFallback');
        
        if (quantityInput && productNameDisplay) {
            productNameDisplay.textContent = this.currentProduct.name;
            quantityInput.style.display = 'block';
            const input = quantityInput.querySelector('#quantityNumber');
            input.value = '';
            input.focus();
        }
    }

    // تأكيد الكمية المدخلة يدوياً
    submitManualQuantity() {
        const quantityInput = document.getElementById('quantityNumber');
        const quantity = parseInt(quantityInput.value);
        
        if (quantity && quantity > 0) {
            this.currentProduct.inputQuantity = quantity;
            this.confirmAddProduct();
            this.hideQuantityInputFallback();
        } else {
            this.showStatus('يرجى إدخال كمية صحيحة', 'error');
            quantityInput.focus();
        }
    }

    // إلغاء الإدخال اليدوي
    cancelManualQuantity() {
        this.hideQuantityInputFallback();
        
        // العودة لمسح الباركود
        setTimeout(() => {
            if (!this.isScanning) {
                this.startBarcodeScanning();
            }
        }, 500);
    }

    // إخفاء قسم الإدخال اليدوي
    hideQuantityInputFallback() {
        const quantityInput = document.getElementById('quantityInputFallback');
        if (quantityInput) {
            quantityInput.style.display = 'none';
        }
    }

    // Voice recognition functionality (محدث للعمل التلقائي)
    showVoiceSection() {
        document.getElementById('voiceSection').style.display = 'block';
        document.getElementById('voiceStatus').textContent = 'اضغط للبدء في التسجيل';
    }

    hideVoiceSection() {
        document.getElementById('voiceSection').style.display = 'none';
    }

    startVoiceRecognition() {
        if (!this.recognition) {
            this.showQuantityInputFallback();
            return;
        }

        // إظهار قسم الصوت مع حالة الاستماع
        this.showVoiceSection();
        const voiceStatus = document.getElementById('voiceStatus');
        if (voiceStatus) {
            voiceStatus.textContent = '🎤 جاري الاستماع... قل الكمية';
        }

        try {
            this.recognition.start();
        } catch (error) {
            console.error('خطأ في بدء التعرف على الصوت:', error);
            this.showQuantityInputFallback();
        }
    }

    stopVoiceRecognition() {
        if (this.recognition) {
            this.recognition.stop();
        }
        this.onVoiceEnd();
    }

    handleVoiceResult(event) {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 نتيجة الصوت:', transcript);
        
        // Extract numbers from Arabic speech
        const quantity = this.extractQuantityFromArabic(transcript);
        
        if (quantity > 0) {
            this.currentProduct.inputQuantity = quantity;
            
            // الانتقال مباشرة للتأكيد بدون الحاجة للضغط على زر تسجيل
            this.hideVoiceSection();
            this.confirmAddProduct();
            
        } else {
            // في حالة عدم فهم الكمية، أعطي فرصة أخرى أو استخدم الطريقة البديلة
            console.log(`لم أفهم الكمية. قلت: "${transcript}".`);
            
            // تشغيل صوت يطلب الإعادة
            if ('speechSynthesis' in window) {
                const utterance = new SpeechSynthesisUtterance('لم أفهم الكمية، حاول مرة أخرى');
                utterance.lang = 'ar-SA';
                speechSynthesis.speak(utterance);
            }
            
            // إعادة المحاولة تلقائياً
            setTimeout(() => {
                this.startVoiceRecognition();
            }, 2000);
        }
        
        this.onVoiceEnd();
    }

    handleVoiceError(event) {
        console.error('خطأ في التعرف على الصوت:', event.error);
        
        // في حالة فشل التعرف على الصوت، استخدم الطريقة البديلة
        this.hideVoiceSection();
        this.showQuantityInputFallback();
        
        this.onVoiceEnd();
    }

    onVoiceEnd() {
        // تنظيف حالة التعرف على الصوت
        const voiceStatus = document.getElementById('voiceStatus');
        if (voiceStatus) {
            voiceStatus.textContent = 'تم الانتهاء من التسجيل';
        }
    }

    extractQuantityFromArabic(text) {
        // Convert Arabic numbers to English
        const arabicNumbers = {
            'صفر': 0, 'واحد': 1, 'اثنان': 2, 'ثلاثة': 3, 'أربعة': 4, 'خمسة': 5,
            'ستة': 6, 'سبعة': 7, 'ثمانية': 8, 'تسعة': 9, 'عشرة': 10,
            'عشرين': 20, 'ثلاثين': 30, 'أربعين': 40, 'خمسين': 50,
            'ستين': 60, 'سبعين': 70, 'ثمانين': 80, 'تسعين': 90, 'مائة': 100
        };

        // Look for direct numbers first
        const numberMatch = text.match(/\d+/);
        if (numberMatch) {
            return parseInt(numberMatch[0]);
        }

        // Look for Arabic number words
        for (const [word, num] of Object.entries(arabicNumbers)) {
            if (text.includes(word)) {
                return num;
            }
        }

        return 0;
    }

    // Confirmation functionality (محدث للانتقال التلقائي)
    showConfirmationSection() {
        document.getElementById('confirmationSection').style.display = 'block';
        document.getElementById('productName').textContent = this.currentProduct.name;
        document.getElementById('productQuantity').textContent = this.currentProduct.inputQuantity;
        
        // Start countdown timer
        this.startConfirmationTimer();
    }

    hideConfirmationSection() {
        document.getElementById('confirmationSection').style.display = 'none';
        if (this.confirmationTimer) {
            clearInterval(this.confirmationTimer);
        }
    }

    startConfirmationTimer() {
        let countdown = 5;
        document.getElementById('timerCount').textContent = countdown;
        document.getElementById('timerText').textContent = countdown;
        
        this.confirmationTimer = setInterval(() => {
            countdown--;
            document.getElementById('timerCount').textContent = countdown;
            document.getElementById('timerText').textContent = countdown;
            
            if (countdown <= 0) {
                this.confirmAddProduct();
            }
        }, 1000);
    }

    confirmAddProduct() {
        this.hideConfirmationSection();
        this.hideVoiceSection();
        this.hideQuantityInputFallback();
        
        // Add to scanned products
        const scannedProduct = {
            id: Date.now(),
            code: this.currentProduct.code,
            name: this.currentProduct.name,
            quantity: this.currentProduct.inputQuantity,
            timestamp: new Date().toISOString()
        };
        
        this.scannedProducts.push(scannedProduct);
        this.renderScannedProducts();
        this.saveToCache();
        this.updateDataStats();
        
        this.showStatus(`تم إضافة ${scannedProduct.name} بكمية ${scannedProduct.quantity}`, 'success');
        
        // Restart scanning
        setTimeout(() => {
            if (!this.isScanning) {
                this.startBarcodeScanning();
            }
        }, 1000);
    }

    cancelAddProduct() {
        this.hideConfirmationSection();
        this.hideVoiceSection();
        this.hideQuantityInputFallback();
        
        // Restart scanning
        setTimeout(() => {
            if (!this.isScanning) {
                this.startBarcodeScanning();
            }
        }, 500);
    }

    // Updated product rendering for single line display
    renderScannedProducts() {
        const listEl = document.getElementById('productsList');
        
        if (this.scannedProducts.length === 0) {
            listEl.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📦</div>
                    <p>لم يتم إضافة أي منتجات بعد</p>
                    <small>قم بمسح الباركود لبدء الإضافة</small>
                </div>
            `;
            return;
        }

        // تنسيق جديد لعرض المنتجات في سطر واحد مع زر تعديل الكمية
        listEl.innerHTML = this.scannedProducts.map(product => `
            <div class="product-item-single-line">
                <span class="product-name">${product.name}</span>
                <span class="product-quantity">${product.quantity}</span>
                <button class="btn btn-edit-quantity" onclick="app.editProductQuantity(${product.id})">
                    ✏️ تعديل
                </button>
            </div>
        `).join('');
    }

    // دالة تعديل الكمية
    editProductQuantity(productId) {
        const product = this.scannedProducts.find(p => p.id === productId);
        if (!product) return;
        
        const newQuantity = prompt(`تعديل كمية ${product.name}:`, product.quantity);
        
        if (newQuantity !== null && !isNaN(newQuantity) && parseInt(newQuantity) > 0) {
            product.quantity = parseInt(newQuantity);
            this.renderScannedProducts();
            this.saveToCache();
            this.updateDataStats();
            this.showStatus(`تم تحديث كمية ${product.name} إلى ${product.quantity}`, 'success');
        }
    }

    // طريقة إظهار نافذة التأكيد لحذف جميع المنتجات
    showDeleteAllConfirmation() {
        if (this.scannedProducts.length === 0) {
            this.showStatus('لا توجد منتجات لحذفها', 'info');
            return;
        }
        
        document.getElementById('deleteAllModal').style.display = 'block';
        document.getElementById('secretCodeInput').value = '';
        document.getElementById('secretCodeInput').focus();
    }

    hideDeleteAllConfirmation() {
        document.getElementById('deleteAllModal').style.display = 'none';
    }

    confirmDeleteAll() {
        const secretCode = document.getElementById('secretCodeInput').value;
        
        if (secretCode === '01470449') {
            // حذف جميع المنتجات
            this.scannedProducts = [];
            this.renderScannedProducts();
            this.saveToCache();
            this.updateDataStats();
            
            this.hideDeleteAllConfirmation();
            this.showStatus('تم حذف جميع المنتجات بنجاح', 'success');
        } else {
            this.showStatus('الرقم السري خاطئ', 'error');
            document.getElementById('secretCodeInput').value = '';
            document.getElementById('secretCodeInput').focus();
        }
    }

    // دالة تصدير البيانات إلى Excel
    exportToExcel() {
        if (this.scannedProducts.length === 0) {
            this.showStatus('لا توجد بيانات للتصدير', 'info');
            return;
        }
        
        try {
            // إنشاء البيانات للتصدير
            const exportData = [
                ['باركود المنتج', 'اسم المنتج', 'الكمية المسحوبة'], // Header
                ...this.scannedProducts.map(product => [
                    product.code,
                    product.name,
                    product.quantity
                ])
            ];
            
            // إنشاء مصنف Excel
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.aoa_to_sheet(exportData);
            
            // تحسين عرض الأعمدة
            ws['!cols'] = [
                { wch: 15 }, // عرض عمود الباركود
                { wch: 30 }, // عرض عمود اسم المنتج
                { wch: 10 }  // عرض عمود الكمية
            ];
            
            XLSX.utils.book_append_sheet(wb, ws, 'المنتجات المسحوبة');
            
            // تحديد اسم الملف بالتاريخ والوقت
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
            const filename = `scanned_products_${dateStr}_${timeStr}.xlsx`;
            
            // تنزيل الملف
            XLSX.writeFile(wb, filename);
            
            this.showStatus(`تم تصدير ${this.scannedProducts.length} منتج بنجاح`, 'success');
            
        } catch (error) {
            console.error('خطأ في تصدير البيانات:', error);
            this.showStatus('خطأ في تصدير البيانات', 'error');
        }
    }

    showStatus(message, type = 'info') {
        const container = document.getElementById('statusContainer');
        
        const statusEl = document.createElement('div');
        statusEl.className = `status-message ${type}`;
        statusEl.textContent = message;
        
        container.appendChild(statusEl);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (statusEl.parentNode) {
                statusEl.parentNode.removeChild(statusEl);
            }
        }, 3000);
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SmartBarcodeApp();
});

// Handle online/offline events
window.addEventListener('online', () => {
    console.log('🌐 عاد الاتصال بالإنترنت');
    if (app) {
        app.checkForUpdates();
    }
});

window.addEventListener('offline', () => {
    console.log('📶 انقطع الاتصال بالإنترنت');
    if (app) {
        app.updateStatus('offline', '📶', 'لا يوجد اتصال بالإنترنت - العمل من البيانات المحفوظة');
    }
});