/**
 * MegaTask - Streak & Lucky Wheel Module (Pure JS & Canvas)
 */
const StreakManager = (function() {
    let _client = null;
    let _tid = null;
    let _onUpdate = null;
    let _userData = null;
    let _timerInterval = null;
    
    // إعدادات الإعلانات
    const AD_STAY_SECONDS = 15;
    const AD_DIRECT_LINK = "https://otootooph.net/4/8916601";
    let _pendingAction = null; // 'streak' أو 'wheel'
    let _adTimer = null;

    // جوائز عجلة الحظ (الزوايا والاحتمالات)
    const WHEEL_SECTORS = [
        { label: "7 نقطة", value: 7, color: "#1e232d", text: "#00d26a" },
        { label: "50 نقطة", value: 50, color: "#00d26a", text: "#000000" },
        { label: "حظ أوفر 💔", value: 0, color: "#161920", text: "#888888" },
        { label: "10 نقطة", value: 10, color: "#ffaa00", text: "#000000" },
        { label: "25 نقطة", value: 25, color: "#1e232d", text: "#ffffff" },
        { label: "50 نقطة 💎", value: 50, color: "#9b51e0", text: "#ffffff" },
        { label: "5 نقطة", value: 5, color: "#161920", text: "#00d26a" },
        { label: "20 نقطة", value: 20, color: "#2d3442", text: "#ffaa00" }
    ];

    let currentAngle = 0;
    let isSpinning = false;

    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    function isYesterday(lastDate, nowDate) {
        const y = new Date(nowDate);
        y.setDate(y.getDate() - 1);
        return isSameDay(lastDate, y);
    }

    function getSecondsUntilMidnight() {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        return Math.max(0, Math.floor((midnight - now) / 1000));
    }

    // تشغيل عداد منتصف الليل للستريك
    function runMidnightTimer(domElements) {
        if (_timerInterval) clearInterval(_timerInterval);

        function tick() {
            const diff = getSecondsUntilMidnight();
            if (diff <= 0) {
                clearInterval(_timerInterval);
                renderUI(domElements);
                return;
            }
            const h = Math.floor(diff / 3600);
            const m = Math.floor((diff % 3600) / 60);
            const s = diff % 60;
            const fmt = `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;

            if (domElements.timerBox) {
                domElements.timerBox.innerText = `⏳ تتجدد المكافأة والعجلة بعد: ${fmt}`;
            }
        }
        tick();
        _timerInterval = setInterval(tick, 1000);
    }

    function renderUI(domElements) {
        const now = new Date();
        const lastClaim = _userData?.last_daily_claim ? new Date(_userData.last_daily_claim) : null;
        const lastSpin = _userData?.last_wheel_spin ? new Date(_userData.last_wheel_spin) : null;

        const claimedToday = lastClaim && isSameDay(lastClaim, now);
        const spunToday = lastSpin && isSameDay(lastSpin, now);

        if (domElements.streakCounter) {
            domElements.streakCounter.innerText = `${_userData?.streak || 0} يوم`;
        }

        if (claimedToday) {
            if (domElements.claimBtn) domElements.claimBtn.style.display = 'none';
            if (domElements.timerBox) domElements.timerBox.style.display = 'block';
            runMidnightTimer(domElements);
        } else {
            if (_timerInterval) clearInterval(_timerInterval);
            if (domElements.claimBtn) {
                domElements.claimBtn.style.display = 'block';
                domElements.claimBtn.disabled = false;
                domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+5 نقطة)";
            }
            if (domElements.timerBox) domElements.timerBox.style.display = 'none';
        }

        if (domElements.wheelBtn) {
            if (spunToday) {
                domElements.wheelBtn.disabled = true;
                domElements.wheelBtn.innerText = "🎡 تم لف عجلة اليوم (تفتح 12 ليلاً)";
            } else {
                domElements.wheelBtn.disabled = false;
                domElements.wheelBtn.innerText = "🎡 عجلة الحظ اليومية (متاحة الآن)";
            }
        }
    }

    // ==========================================
    // نظام فحص وتأكيد الإعلان الإجباري
    // ==========================================
    function triggerAdFlow(actionType, domElements) {
        _pendingAction = actionType;

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openLink(AD_DIRECT_LINK);
        } else {
            window.open(AD_DIRECT_LINK, '_blank');
        }

        const modal = document.getElementById('streak-ad-modal');
        const countDisplay = document.getElementById('streak-ad-countdown');
        const confirmBtn = document.getElementById('streak-ad-confirm-btn');
        const info = document.getElementById('streak-ad-info');

        info.innerHTML = actionType === 'streak'
            ? "يجب تصفح صفحة الإعلان لمدة 15 ثانية لاعتماد مكافأة الدخول اليومي."
            : "يجب تصفح صفحة الإعلان لمدة 15 ثانية لتفعيل لفة عجلة الحظ المجانية.";

        modal.style.display = 'flex';
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.5';
        confirmBtn.innerText = "انتظر انتهاء العداد والتفاعل...";

        let secondsLeft = AD_STAY_SECONDS;
        countDisplay.innerText = secondsLeft;

        if (_adTimer) clearInterval(_adTimer);

        _adTimer = setInterval(() => {
            secondsLeft--;
            countDisplay.innerText = secondsLeft;

            if (secondsLeft <= 0) {
                clearInterval(_adTimer);
                countDisplay.innerText = "✅";
                confirmBtn.disabled = false;
                confirmBtn.style.opacity = '1';
                confirmBtn.innerText = actionType === 'streak' ? "تأكيد استلام +5 نقطة" : "فتح عجلة الحظ الآن 🎡";
            }
        }, 1000);
    }

    async function onAdConfirmed(domElements) {
        document.getElementById('streak-ad-modal').style.display = 'none';

        if (_pendingAction === 'streak') {
            await executeStreakClaim(domElements);
        } else if (_pendingAction === 'wheel') {
            openWheelModalUI();
        }
        _pendingAction = null;
    }

    // تنفيذ إضافة مكافأة الستريك
    async function executeStreakClaim(domElements) {
        try {
            const { data: userCurrent } = await _client.from('users').select('*').eq('telegram_id', _tid).single();
            const now = new Date();

            let newStreak = 1;
            if (userCurrent.last_daily_claim) {
                const last = new Date(userCurrent.last_daily_claim);
                if (isYesterday(last, now)) {
                    newStreak = (userCurrent.streak || 0) + 1;
                }
            }

            const updatedPoints = (userCurrent.points || 0) + 5;
            const nowIso = now.toISOString();

            const { data: saved, error } = await _client.from('users').update({
                points: updatedPoints,
                streak: newStreak,
                last_daily_claim: nowIso
            }).eq('telegram_id', _tid).select().single();

            if (!error && saved) {
                _userData = saved;
                if (typeof _onUpdate === 'function') _onUpdate(saved);
                renderUI(domElements);
                window.Telegram?.WebApp?.showAlert(`🎉 مبروك! استلمت +5 نقطة.\n🔥 الستريك الحالي: ${newStreak} أيام متتالية!`);
            }
        } catch (e) {
            console.error("Streak save error:", e);
        }
    }

    // ==========================================
    // رسم وتشغيل عجلة الحظ (HTML5 Canvas)
    // ==========================================
    function drawWheel() {
        const canvas = document.getElementById('wheel-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const numSectors = WHEEL_SECTORS.length;
        const arc = (2 * Math.PI) / numSectors;
        const radius = canvas.width / 2;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        WHEEL_SECTORS.forEach((sec, i) => {
            const angle = currentAngle + i * arc;
            ctx.beginPath();
            ctx.fillStyle = sec.color;
            ctx.moveTo(radius, radius);
            ctx.arc(radius, radius, radius - 6, angle, angle + arc);
            ctx.lineTo(radius, radius);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#2b3240";
            ctx.stroke();

            // رسم النص
            ctx.save();
            ctx.translate(radius, radius);
            ctx.rotate(angle + arc / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = sec.text;
            ctx.font = "bold 13px 'Segoe UI', Tahoma";
            ctx.fillText(sec.label, radius - 20, 5);
            ctx.restore();
        });

        // المركز
        ctx.beginPath();
        ctx.arc(radius, radius, 18, 0, 2 * Math.PI);
        ctx.fillStyle = "#0b0d10";
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#00d26a";
        ctx.stroke();
    }

    function openWheelModalUI() {
        document.getElementById('wheel-modal').style.display = 'flex';
        drawWheel();
        document.getElementById('wheel-spin-btn').disabled = false;
        document.getElementById('wheel-result-msg').innerText = "اضغط على زر التدوير لتحديد جائزتك!";
    }

    function spinWheel(domElements) {
        if (isSpinning) return;
        isSpinning = true;

        const spinBtn = document.getElementById('wheel-spin-btn');
        spinBtn.disabled = true;
        document.getElementById('wheel-result-msg').innerText = "جاري تدوير العجلة...";

        // تحديد الجائزة عشوائياً وفق أوزان مدروسة
        const winningIndex = Math.floor(Math.random() * WHEEL_SECTORS.length);
        const prize = WHEEL_SECTORS[winningIndex];

        const numSectors = WHEEL_SECTORS.length;
        const arc = (2 * Math.PI) / numSectors;
        
        // حساب الزاوية المطلوبة لتقف العجلة عند المؤشر (المؤشر بالأعلى عند 270 درجة أو 1.5 * PI)
        const targetSectorCenter = winningIndex * arc + arc / 2;
        const stopAngle = (1.5 * Math.PI) - targetSectorCenter;
        const totalRotations = (5 + Math.floor(Math.random() * 3)) * (2 * Math.PI); // 5 إلى 7 لفات كاملة
        const finalTargetAngle = currentAngle + totalRotations + ((stopAngle - (currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));

        const duration = 4500;
        const startTime = performance.now();
        const startAngle = currentAngle;

        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // حركة دوران تخميدية ناعمة (Ease Out Quart)
            const easeOut = 1 - Math.pow(1 - progress, 4);

            currentAngle = startAngle + (finalTargetAngle - startAngle) * easeOut;
            drawWheel();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                isSpinning = false;
                onWheelStopped(prize, domElements);
            }
        }

        requestAnimationFrame(animate);
    }

    async function onWheelStopped(prize, domElements) {
        const msg = document.getElementById('wheel-result-msg');

        try {
            const { data: userCurrent } = await _client.from('users').select('points').eq('telegram_id', _tid).single();
            const newPoints = (userCurrent.points || 0) + prize.value;
            const nowIso = new Date().toISOString();

            const { data: updated } = await _client.from('users').update({
                points: newPoints,
                last_wheel_spin: nowIso
            }).eq('telegram_id', _tid).select().single();

            if (updated) {
                _userData = updated;
                if (typeof _onUpdate === 'function') _onUpdate(updated);
                renderUI(domElements);
            }

            if (prize.value > 0) {
                msg.innerHTML = `🎉 مبروك! فزت بـ <b style="color: #00d26a;">+${prize.value} نقطة</b>`;
            } else {
                msg.innerHTML = `💔 حظ أوفر في المرة القادمة!`;
            }

        } catch (e) {
            console.error("Save wheel error:", e);
        }
    }

    return {
        init: function(client, tid, initialUser, domElements, onUpdateCallback) {
            _client = client;
            _tid = tid;
            _userData = initialUser;
            _onUpdate = onUpdateCallback;

            if (domElements.claimBtn) {
                domElements.claimBtn.onclick = () => triggerAdFlow('streak', domElements);
            }

            if (domElements.wheelBtn) {
                domElements.wheelBtn.onclick = () => triggerAdFlow('wheel', domElements);
            }

            const confirmBtn = document.getElementById('streak-ad-confirm-btn');
            if (confirmBtn) {
                confirmBtn.onclick = () => onAdConfirmed(domElements);
            }

            const spinBtn = document.getElementById('wheel-spin-btn');
            if (spinBtn) {
                spinBtn.onclick = () => spinWheel(domElements);
            }

            renderUI(domElements);
        },
        closeWheelModal: function() {
            if (!isSpinning) {
                document.getElementById('wheel-modal').style.display = 'none';
            }
        }
    };
})();
