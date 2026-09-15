/**
 * MegaTask - Streak & Lucky Wheel Module (Auto-Create User & Monetag Integrated)
 * Zone ID: 10959333
 */
const StreakManager = (function() {
    let _client = null;
    let _tid = null;
    let _onUpdate = null;
    let _userData = null;
    let _timerInterval = null;
    let _pendingAction = null;

    // جوائز عجلة الحظ (الحد الأقصى 25 نقطة)
    const WHEEL_SECTORS = [
        { label: "5 نقطة", value: 5, color: "#161920", text: "#00d26a" },
        { label: "10 نقطة", value: 10, color: "#1e232d", text: "#00d26a" },
        { label: "حظ أوفر 💔", value: 0, color: "#161920", text: "#888888" },
        { label: "15 نقطة", value: 15, color: "#1e232d", text: "#ffaa00" },
        { label: "25 نقطة 💎", value: 25, color: "#00d26a", text: "#000000" },
        { label: "5 نقطة", value: 5, color: "#2d3442", text: "#ffffff" },
        { label: "10 نقطة", value: 10, color: "#161920", text: "#ffaa00" },
        { label: "20 نقطة", value: 20, color: "#1e232d", text: "#ffffff" }
    ];

    // قوائم الألقاب الدقيقة
    const MALE_TITLES = [
        "جميل", "أنيق", "رائع", "بديع", "اخاذ", "جذاب", "خلاب", "ساحر", "متعلم", "قويم",
        "فهيم", "ذكي", "مجتهد", "مثابر", "سمح", "كريم", "كفو", "شهم", "رجل", "عنيد",
        "مغامر", "شنب", "محزم", "ذيب (ذيبان)", "نشمي", "مطنوخ", "محارب (مقاتل)", "عظيم", "شيخ", "شامخ",
        "قوي", "شجاع", "مقدام", "بتار", "كسار", "صلب", "بطل", "فارس", "مغوار", "قائد",
        "زعيم", "صنديد", "أشوس", "ملك", "صقر", "نمر", "جلاد", "مرعب", "أسد", "غضنفر",
        "فتاك", "سفاح", "جبار", "أسطورة"
    ];

    const FEMALE_TITLES = [
        "جميلة", "أنيقة", "رائعة", "بديعة", "آخاذة", "جذابة", "خلابة", "ساحرة", "متعلمة", "قويمة",
        "فهيمة", "ذكية", "مجتهدة", "مثابرة", "سمحة", "كريمة", "كفؤ", "شهيمة", "امرأة", "عنيدة",
        "مغامرة", "محزمة", "ذيبانة", "نشمية", "مطنوخة", "محاربة (مقاتلة)", "عظيمة", "شيخة", "شامخة",
        "قوية", "شجاعة", "مقدامة", "بتارة", "كسارة", "صلبة", "بطلة", "فارسة", "مغوارة", "قائدة",
        "زعيمة", "صنديدة", "مهيبة", "ملكة", "صقرية", "لبؤة", "مرعبة", "ضارية", "فتاكة", "قاهرة",
        "جبارة", "أسطورة"
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
                domElements.timerBox.innerText = `⏳ تتجدد المكافآت بعد: ${fmt}`;
            }
        }
        tick();
        _timerInterval = setInterval(tick, 1000);
    }

    function getStreakTierData(streak, gender) {
        const list = (gender === 'female') ? FEMALE_TITLES : MALE_TITLES;
        const index = Math.max(0, Math.min(streak - 1, list.length - 1));
        const title = list[index];

        const tier = Math.floor((streak - 1) / 25);
        let flameColor = "#ffaa00"; 
        let glowShadow = "0 0 15px rgba(255, 170, 0, 0.3)";
        let fireScale = 1 + Math.min(streak * 0.015, 0.4); 

        if (tier === 1) {
            flameColor = "#00f2ff"; 
            glowShadow = "0 0 25px rgba(0, 242, 255, 0.5)";
        } else if (tier === 2) {
            flameColor = "#bc13fe"; 
            glowShadow = "0 0 35px rgba(188, 19, 254, 0.6)";
        } else if (tier >= 3) {
            flameColor = "#00d26a"; 
            glowShadow = "0 0 45px rgba(0, 210, 106, 0.8)";
        }

        return { title, flameColor, glowShadow, fireScale };
    }

    function applyStreakVisualEffects(streakVal, gender, cardElement) {
        if (!cardElement) return;
        const tierData = getStreakTierData(streakVal, gender);

        cardElement.style.border = `2px solid ${tierData.flameColor}`;
        cardElement.style.boxShadow = tierData.glowShadow;
        cardElement.style.transition = "all 0.4s ease";

        const infoSpan = cardElement.querySelector('.streak-info span');
        const iconBox = cardElement.querySelector('.streak-icon');

        if (iconBox) {
            iconBox.style.transform = `scale(${tierData.fireScale})`;
            iconBox.style.color = tierData.flameColor;
            iconBox.style.borderColor = tierData.flameColor;
            iconBox.style.boxShadow = `0 0 12px ${tierData.flameColor}88`;
        }

        if (infoSpan) {
            infoSpan.innerHTML = `🔥 اللقب: <b style="color: ${tierData.flameColor};">${tierData.title}</b> (مستوى ${Math.floor((streakVal-1)/25)+1})`;
        }
    }

    function renderUI(domElements) {
        const now = new Date();
        const lastClaim = _userData?.last_daily_claim ? new Date(_userData.last_daily_claim) : null;
        const lastSpin = _userData?.last_wheel_spin ? new Date(_userData.last_wheel_spin) : null;

        const claimedToday = lastClaim && isSameDay(lastClaim, now);
        const spunToday = lastSpin && isSameDay(lastSpin, now);
        const currentStreak = _userData?.streak || 0;
        const userGender = _userData?.gender || 'male';

        if (domElements.streakCounter) {
            domElements.streakCounter.innerText = `${currentStreak} يوم`;
        }

        const cardBox = document.querySelector('.streak-fullwidth-card');
        applyStreakVisualEffects(currentStreak, userGender, cardBox);

        if (claimedToday) {
            if (domElements.claimBtn) domElements.claimBtn.style.display = 'none';
            if (domElements.timerBox) domElements.timerBox.style.display = 'block';
            runMidnightTimer(domElements);
        } else {
            if (_timerInterval) clearInterval(_timerInterval);
            if (domElements.claimBtn) {
                domElements.claimBtn.style.display = 'block';
                domElements.claimBtn.disabled = false;
                domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+5 نقاط)";
            }
            if (domElements.timerBox) domElements.timerBox.style.display = 'none';
        }

        if (domElements.wheelBtn) {
            if (spunToday) {
                domElements.wheelBtn.disabled = true;
                domElements.wheelBtn.innerText = "🎡 تم تدوير عجلة اليوم (تفتح 12 ليلاً)";
                domElements.wheelBtn.style.opacity = "0.6";
            } else {
                domElements.wheelBtn.disabled = false;
                domElements.wheelBtn.innerText = "🎡 عجلة الحظ اليومية (متاحة الآن)";
                domElements.wheelBtn.style.opacity = "1";
            }
        }
    }

    function promptGenderSelection() {
        return new Promise((resolve) => {
            const existingModal = document.getElementById('gender-select-modal');
            if (existingModal) existingModal.remove();

            const modalHtml = `
                <div id="gender-select-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.88); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:#161920; border:1px solid #2d333d; border-radius:20px; padding:25px; width:100%; max-width:320px; text-align:center;">
                        <h3 style="color:#00d26a; margin-top:0; margin-bottom:10px;">🎯 حدد نوعك لتخصيص الألقاب</h3>
                        <p style="font-size:13px; color:#9ca3af; margin-bottom:20px;">اختر التصنيف المناسب لكي يتم حساب ألقاب الستريك وتطورها بدقة:</p>
                        <div style="display:flex; gap:12px; margin-bottom:10px;">
                            <button id="btn-gender-male" style="flex:1; background:#1e232d; border:1px solid #333; color:white; padding:14px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:14px;">🧔 ذكر</button>
                            <button id="btn-gender-female" style="flex:1; background:#1e232d; border:1px solid #333; color:white; padding:14px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:14px;">👩 أنثى</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            document.getElementById('btn-gender-male').onclick = () => {
                document.getElementById('gender-select-modal').remove();
                resolve('male');
            };
            document.getElementById('btn-gender-female').onclick = () => {
                document.getElementById('gender-select-modal').remove();
                resolve('female');
            };
        });
    }

    // فحص وإنشاء المستخدم فوراً عند بدء التشغيل مع طلب النوع لو غير موجود
    async function getOrCreateUser() {
        if (!_tid || _tid === "test_user") {
            const fallbackId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "123456789");
            _tid = fallbackId;
        }

        let { data: userCurrent } = await _client
            .from('users')
            .select('*')
            .eq('telegram_id', _tid)
            .maybeSingle();

        if (!userCurrent) {
            const genderChoice = await promptGenderSelection();
            const { data: newUser, error: insErr } = await _client
                .from('users')
                .insert([{ telegram_id: _tid, points: 0, streak: 1, gender: genderChoice }])
                .select()
                .single();

            if (!insErr && newUser) {
                userCurrent = newUser;
            }
        } else if (!userCurrent.gender) {
            const genderChoice = await promptGenderSelection();
            const { data: updatedG } = await _client
                .from('users')
                .update({ gender: genderChoice })
                .eq('telegram_id', _tid)
                .select()
                .single();
            if (updatedG) userCurrent = updatedG;
        }

        return userCurrent;
    }

    function triggerAdFlow(actionType, domElements) {
        _pendingAction = actionType;

        if (typeof show_10959333 !== 'function') {
            window.Telegram?.WebApp?.showAlert("⚠️ نظام الإعلانات لم يتم تحميله بعد، يرجى إعادة تحميل الصفحة.");
            return;
        }

        show_10959333().then(async () => {
            if (_pendingAction === 'streak') {
                await executeStreakClaim(domElements);
            } else if (_pendingAction === 'wheel') {
                openWheelModalUI();
            }
            _pendingAction = null;
        }).catch((err) => {
            console.error("Monetag Ad Error:", err);
            window.Telegram?.WebApp?.showAlert("❌ لم تكتمل مشاهدة الإعلان، يجب مشاهدته بالكامل للحصول على المكافأة!");
        });
    }

    async function executeStreakClaim(domElements) {
        try {
            const userCurrent = await getOrCreateUser();
            if (!userCurrent) {
                window.Telegram?.WebApp?.showAlert("❌ تعذر إنشاء أو جلب حسابك من السيرفر.");
                return;
            }

            const now = new Date();
            let newStreak = 1;

            if (userCurrent.last_daily_claim) {
                const last = new Date(userCurrent.last_daily_claim);
                if (isSameDay(last, now)) {
                    window.Telegram?.WebApp?.showAlert("⛔ لقد استلمت مكافأة الستريك اليوم بالفعل!");
                    renderUI(domElements);
                    return;
                }
                if (isYesterday(last, now)) {
                    newStreak = (userCurrent.streak || 0) + 1;
                } else {
                    newStreak = 1; // ضاع اليوم، يبدأ من جديد
                }
            }

            const updatedPoints = (userCurrent.points || 0) + 5;
            const nowIso = now.toISOString();
            const userGender = userCurrent.gender || 'male';
            const tierInfo = getStreakTierData(newStreak, userGender);

            const { data: saved, error: updateErr } = await _client
                .from('users')
                .update({
                    points: updatedPoints,
                    streak: newStreak,
                    last_daily_claim: nowIso
                })
                .eq('telegram_id', _tid)
                .select()
                .single();

            if (!updateErr && saved) {
                _userData = saved;
                if (typeof _onUpdate === 'function') _onUpdate(saved);
                renderUI(domElements);
                window.Telegram?.WebApp?.showAlert(`🎉 مبروك! استلمت +5 نقاط.\n🔥 الستريك: ${newStreak} أيام متتالية!\n⭐ لقبك الحالي: ${tierInfo.title}`);
            } else {
                window.Telegram?.WebApp?.showAlert("❌ خطأ أثناء تحديث النقاط: " + (updateErr?.message || ""));
            }
        } catch (e) {
            console.error("Streak save error:", e);
            window.Telegram?.WebApp?.showAlert("❌ حدث خطأ غير متوقع أثناء حفظ المكافأة.");
        }
    }

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

            ctx.save();
            ctx.translate(radius, radius);
            ctx.rotate(angle + arc / 2);
            ctx.textAlign = "right";
            ctx.fillStyle = sec.text;
            ctx.font = "bold 13px 'Segoe UI', Tahoma";
            ctx.fillText(sec.label, radius - 20, 5);
            ctx.restore();
        });

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

        const winningIndex = Math.floor(Math.random() * WHEEL_SECTORS.length);
        const prize = WHEEL_SECTORS[winningIndex];

        const numSectors = WHEEL_SECTORS.length;
        const arc = (2 * Math.PI) / numSectors;
        const targetSectorCenter = winningIndex * arc + arc / 2;
        const stopAngle = (1.5 * Math.PI) - targetSectorCenter;
        const totalRotations = (5 + Math.floor(Math.random() * 3)) * (2 * Math.PI);
        const finalTargetAngle = currentAngle + totalRotations + ((stopAngle - (currentAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));

        const duration = 4500;
        const startTime = performance.now();
        const startAngle = currentAngle;

        function animate(time) {
            const elapsed = time - startTime;
            const progress = Math.min(elapsed / duration, 1);
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
            const userCurrent = await getOrCreateUser();
            if (!userCurrent) {
                window.Telegram?.WebApp?.showAlert("❌ تعذر حفظ جائزة العجلة، حسابك غير موجود.");
                return;
            }

            const newPoints = (userCurrent.points || 0) + prize.value;
            const nowIso = new Date().toISOString();

            const { data: updated, error: updateErr } = await _client
                .from('users')
                .update({
                    points: newPoints,
                    last_wheel_spin: nowIso
                })
                .eq('telegram_id', _tid)
                .select()
                .single();

            if (!updateErr && updated) {
                _userData = updated;
                if (typeof _onUpdate === 'function') _onUpdate(updated);
                renderUI(domElements);
            } else {
                window.Telegram?.WebApp?.showAlert("❌ خطأ أثناء حفظ جائزة العجلة: " + (updateErr?.message || ""));
            }

            if (prize.value > 0) {
                msg.innerHTML = `🎉 مبروك! فزت بـ <b style="color: #00d26a;">+${prize.value} نقطة</b>`;
            } else {
                msg.innerHTML = `💔 حظ أوفر في المرة القادمة!`;
            }

        } catch (e) {
            console.error("Save wheel error:", e);
            window.Telegram?.WebApp?.showAlert("❌ حدث خطأ غير متوقع أثناء معالجة الجائزة.");
        }
    }

    return {
        init: async function(client, tid, initialUser, domElements, onUpdateCallback) {
            _client = client;
            _tid = tid;
            _userData = initialUser;
            _onUpdate = onUpdateCallback;

            // التحقق من المستخدم وإظهار اختيار النوع فوراً عند الفتح لو غير مسجل
            _userData = await getOrCreateUser();
            if (_userData && typeof _onUpdate === 'function') {
                _onUpdate(_userData);
            }

            if (domElements.claimBtn) {
                domElements.claimBtn.onclick = () => triggerAdFlow('streak', domElements);
            }

            if (domElements.wheelBtn) {
                domElements.wheelBtn.onclick = () => triggerAdFlow('wheel', domElements);
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
