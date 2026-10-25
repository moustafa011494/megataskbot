/**
 * MegaTask - Streak & Lucky Wheel Module (Updated Economy, Referral Sync & Anti-Race Lock)
 * Zone ID: 10959333
 */
const StreakManager = (function() {
    let _client = null;
    let _tid = null;
    let _onUpdate = null;
    let _userData = null;
    let _timerInterval = null;
    let _pendingAction = null;
    let _wasBrokenBeforeClaim = false;
    let _isBusyClaiming = false;

    // ⭐ جوائز عجلة الحظ (الحد الأقصى 10 نقاط لضمان ربح البوت من الإعلان)
    const WHEEL_SECTORS = [
        { label: "2 نقطة", value: 2, color: "#161920", text: "#00d26a" },
        { label: "5 نقاط", value: 5, color: "#1e232d", text: "#00d26a" },
        { label: "حظ أوفر 💔", value: 0, color: "#161920", text: "#888888" },
        { label: "3 نقاط", value: 3, color: "#1e232d", text: "#ffaa00" },
        { label: "10 نقاط 💎", value: 10, color: "#00d26a", text: "#000000" },
        { label: "1 نقطة", value: 1, color: "#2d3442", text: "#ffffff" },
        { label: "4 نقاط", value: 4, color: "#161920", text: "#ffaa00" },
        { label: "2 نقطة", value: 2, color: "#1e232d", text: "#ffffff" }
    ];

    const STREAK_DAILY_REWARD = 5; // 5 نقاط لمكافأة الستريك اليومي

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
        if (!streak || streak <= 0) {
            return {
                title: "مبتدئ (ابدأ الستريك اليوم!)",
                level: 0,
                flameColor: "#6b7280",
                glowShadow: "0 4px 15px rgba(0, 0, 0, 0.25)",
                fireScale: 1
            };
        }

        const list = (gender === 'female') ? FEMALE_TITLES : MALE_TITLES;
        const index = Math.max(0, Math.min(streak - 1, list.length - 1));
        const title = list[index];

        const tier = Math.floor((streak - 1) / 15);
        const level = tier + 1;
        let flameColor = "#ffaa00"; 
        let glowShadow = "0 0 15px rgba(255, 170, 0, 0.35)";
        let fireScale = 1 + Math.min(streak * 0.015, 0.35); 

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

        return { title, level, flameColor, glowShadow, fireScale };
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
            iconBox.style.boxShadow = streakVal > 0 ? `0 0 12px ${tierData.flameColor}88` : "none";
        }

        if (infoSpan) {
            if (streakVal > 0) {
                infoSpan.innerHTML = `🔥 اللقب: <b style="color: ${tierData.flameColor};">${tierData.title}</b> (مستوى ${tierData.level})`;
            } else {
                infoSpan.innerHTML = `⚪ اللقب: <b style="color: #9ca3af;">${tierData.title}</b>`;
            }
        }
    }

    function renderUI(domElements) {
        const now = new Date();
        const rawClaimDate = _userData?.last_claim || _userData?.last_daily_claim;
        const lastClaim = rawClaimDate ? new Date(rawClaimDate) : null;
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
        } else {
            if (domElements.claimBtn) {
                domElements.claimBtn.style.display = 'block';
                domElements.claimBtn.disabled = false;
                domElements.claimBtn.innerText = `🎁 استلام مكافأة اليوم (+${STREAK_DAILY_REWARD} نقاط)`;
            }
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

        if (claimedToday && spunToday) {
            if (domElements.timerBox) domElements.timerBox.style.display = 'block';
            runMidnightTimer(domElements);
        } else {
            if (_timerInterval) clearInterval(_timerInterval);
            if (domElements.timerBox) domElements.timerBox.style.display = 'none';
        }
    }

    function promptGenderSelection() {
        return new Promise((resolve) => {
            const existingModal = document.getElementById('gender-select-modal');
            if (existingModal) existingModal.remove();

            const modalHtml = `
                <div id="gender-select-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;">
                    <div style="background:#161920; border:1px solid #00d26a; border-radius:20px; padding:25px; width:100%; max-width:320px; text-align:center; box-shadow:0 0 25px rgba(0,210,106,0.2);">
                        <h3 style="color:#00d26a; margin-top:0; margin-bottom:10px;">🎯 حدد نوعك لتخصيص الألقاب</h3>
                        <p style="font-size:13px; color:#9ca3af; margin-bottom:20px;">اختر التصنيف المناسب لكي تظهر لك ألقاب الستريك اليومية الخاصة بك:</p>
                        <div style="display:flex; gap:12px; margin-bottom:10px;">
                            <button id="btn-gender-male" style="flex:1; background:#1e232d; border:1px solid #00d26a; color:white; padding:14px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:14px;">🧔 ذكر</button>
                            <button id="btn-gender-female" style="flex:1; background:#1e232d; border:1px solid #00f2ff; color:white; padding:14px; border-radius:12px; font-weight:bold; cursor:pointer; font-size:14px;">👩 أنثى</button>
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

    async function checkAndResetBrokenStreak(userObj) {
        if (!userObj) return userObj;
        const rawClaimDate = userObj.last_claim || userObj.last_daily_claim;
        if (!rawClaimDate) return userObj;

        const now = new Date();
        const lastDate = new Date(rawClaimDate);

        if (!isSameDay(lastDate, now) && !isYesterday(lastDate, now)) {
            if ((userObj.streak || 0) > 0) {
                _wasBrokenBeforeClaim = true;
                const { data: resetUser } = await _client
                    .from('users')
                    .update({ streak: 0 })
                    .eq('telegram_id', _tid)
                    .select()
                    .single();

                if (resetUser) {
                    window.Telegram?.WebApp?.showAlert("💔 لقد فوّت تسجيل الدخول يوم أمس، لذلك عاد عداد الستريك إلى (0 يوم)!");
                    return resetUser;
                }
                userObj.streak = 0;
            }
        }
        return userObj;
    }

    async function getOrCreateUser() {
        if (typeof MegaSecurity !== 'undefined' && MegaSecurity.getVerifiedUserId) {
            _tid = MegaSecurity.getVerifiedUserId(_tid);
        }
        if (!_tid || _tid === "undefined" || _tid === "null") {
            return null;
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
                .insert([{ 
                    telegram_id: _tid, 
                    name: window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || "AGENT",
                    points: 0, 
                    egp_balance: 0,
                    total_earned: 0,
                    streak: 0,
                    gender: genderChoice 
                }])
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

        userCurrent = await checkAndResetBrokenStreak(userCurrent);
        return userCurrent;
    }

    // ⭐ إضافة النقاط + تحديث total_earned + تسجيل الهيستوري + 10% عمولة إحالة للداعي شاملة total_ref_commission
    async function addPointsAndLog(pointsChange, titleText) {
        try {
            let { data: uInfo } = await _client
                .from('users')
                .select('points, total_earned, referred_by')
                .eq('telegram_id', String(_tid))
                .single();

            const currentP = uInfo ? (uInfo.points || 0) : 0;
            const currentTotalEarned = uInfo ? (uInfo.total_earned || 0) : 0;
            const newTotalP = currentP + pointsChange;
            const newTotalEarned = currentTotalEarned + pointsChange;

            await _client.from('users').update({ 
                points: newTotalP,
                total_earned: newTotalEarned
            }).eq('telegram_id', String(_tid));

            await _client.from('transactions').insert([{
                telegram_id: String(_tid),
                type: 'points',
                title: titleText,
                amount: `+${pointsChange} نقطة`,
                status: 'مكتمل'
            }]);

            if (uInfo && uInfo.referred_by && String(uInfo.referred_by) !== String(_tid)) {
                const refBonus = Math.max(1, Math.round(pointsChange * 0.10));
                const { data: refUser } = await _client
                    .from('users')
                    .select('points, total_earned, total_ref_commission')
                    .eq('telegram_id', String(uInfo.referred_by))
                    .maybeSingle();

                if (refUser) {
                    await _client.from('users').update({
                        points: (refUser.points || 0) + refBonus,
                        total_earned: (refUser.total_earned || 0) + refBonus,
                        total_ref_commission: (refUser.total_ref_commission || 0) + refBonus
                    }).eq('telegram_id', String(uInfo.referred_by));
                }
            }

            return { points: newTotalP, total_earned: newTotalEarned };
        } catch (err) {
            console.error(err);
            return false;
        }
    }

    function triggerAdFlow(actionType, domElements) {
        if (_isBusyClaiming || isSpinning) return;
        _pendingAction = actionType;

        if (typeof show_10959333 !== 'function') {
            window.Telegram?.WebApp?.showAlert("⚠️ نظام الإعلانات لم يتم تحميله بعد، يرجى إعادة تحميل الصفحة.");
            return;
        }

        _isBusyClaiming = true;
        show_10959333().then(async () => {
            if (_pendingAction === 'streak') {
                await executeStreakClaim(domElements);
            } else if (_pendingAction === 'wheel') {
                openWheelModalUI();
            }
            _pendingAction = null;
            _isBusyClaiming = false;
        }).catch((err) => {
            _isBusyClaiming = false;
            console.error("Monetag Ad Error:", err);
            window.Telegram?.WebApp?.showAlert("❌ لم تكتمل مشاهدة الإعلان، يجب مشاهدته بالكامل للحصول على المكافأة!");
        });
    }

    async function executeStreakClaim(domElements) {
        try {
            const userCurrent = await getOrCreateUser();
            if (!userCurrent) {
                window.Telegram?.WebApp?.showAlert("❌ تعذر جلب حسابك من السيرفر.");
                return;
            }

            const now = new Date();
            const rawClaimDate = userCurrent.last_claim || userCurrent.last_daily_claim;
            let newStreak = 1;

            if (rawClaimDate) {
                const last = new Date(rawClaimDate);
                if (isSameDay(last, now)) {
                    window.Telegram?.WebApp?.showAlert("⛔ لقد استلمت مكافأة الستريك اليوم بالفعل!");
                    renderUI(domElements);
                    return;
                }
                if (isYesterday(last, now) && !_wasBrokenBeforeClaim) {
                    newStreak = (userCurrent.streak || 0) + 1;
                } else {
                    newStreak = 0;
                    _wasBrokenBeforeClaim = false;
                }
            } else {
                newStreak = 1;
            }

            const nowIso = now.toISOString();
            const userGender = userCurrent.gender || 'male';
            const tierInfo = getStreakTierData(newStreak, userGender);

            const { data: saved, error: updateErr } = await _client
                .from('users')
                .update({
                    streak: newStreak,
                    last_claim: nowIso
                })
                .eq('telegram_id', _tid)
                .select()
                .single();

            if (!updateErr && saved) {
                const updatedTotals = await addPointsAndLog(STREAK_DAILY_REWARD, `مكافأة الستريك اليومي (اليوم ${newStreak})`);
                
                if (updatedTotals !== false) {
                    saved.points = updatedTotals.points;
                    saved.total_earned = updatedTotals.total_earned;
                }
                _userData = saved;

                if (typeof _onUpdate === 'function') _onUpdate(saved);

                renderUI(domElements);

                const cardBox = document.getElementById('streak-card-box');
                if (cardBox) {
                    cardBox.classList.add('streak-glow-effect');
                    setTimeout(() => cardBox.classList.remove('streak-glow-effect'), 1000);
                }

                if (newStreak === 0) {
                    window.Telegram?.WebApp?.showAlert(`🎁 استلمت مكافأة اليوم (+${STREAK_DAILY_REWARD} نقاط)!\n⚠️ لأنك فوّت أياماً سابقة، تم تصفير عداد الستريك إلى (0 يوم). استلم غداً ليبدأ العداد في الزيادة!`);
                } else {
                    window.Telegram?.WebApp?.showAlert(`🎉 مبروك! استلمت +${STREAK_DAILY_REWARD} نقاط.\n🔥 الستريك: ${newStreak} أيام متتالية!\n⭐ لقبك الحالي: ${tierInfo.title}`);
                }
            } else {
                window.Telegram?.WebApp?.showAlert("❌ خطأ أثناء تحديث الستريك: " + (updateErr?.message || ""));
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

            const now = new Date();
            if (userCurrent.last_wheel_spin && isSameDay(new Date(userCurrent.last_wheel_spin), now)) {
                renderUI(domElements);
                window.Telegram?.WebApp?.showAlert("⛔ لقد قمت بتدوير عجلة الحظ اليوم بالفعل!");
                return;
            }

            const nowIso = now.toISOString();

            const { data: updated, error: updateErr } = await _client
                .from('users')
                .update({
                    last_wheel_spin: nowIso
                })
                .eq('telegram_id', _tid)
                .select()
                .single();

            if (!updateErr && updated) {
                if (prize.value > 0) {
                    const updatedTotals = await addPointsAndLog(prize.value, 'جائزة عجلة الحظ اليومية');
                    if (updatedTotals !== false) {
                        updated.points = updatedTotals.points;
                        updated.total_earned = updatedTotals.total_earned;
                    }
                }

                _userData = updated;
                if (typeof _onUpdate === 'function') _onUpdate(updated);

                renderUI(domElements);
            } else {
                window.Telegram?.WebApp?.showAlert("❌ خطأ أثناء حفظ العجلة: " + (updateErr?.message || ""));
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
