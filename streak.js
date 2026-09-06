/**
 * MegaTask - Streak & Daily Rewards Module
 * يتولى إدارة السلسلة اليومية، الاحتساب حتى منتصف الليل، وتجهيز جوائز عجلة الحظ
 */
const StreakManager = (function() {
    let _client = null;
    let _tid = null;
    let _onUpdate = null;
    let _timerInterval = null;
    let _userData = null;

    // فحص تطابق يومين (تقويمياً)
    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    // فحص هل التاريخ كان أمس بالضبط
    function isYesterday(lastDate, nowDate) {
        const yesterday = new Date(nowDate);
        yesterday.setDate(yesterday.getDate() - 1);
        return isSameDay(lastDate, yesterday);
    }

    // حساب الثواني المتبقية حتى الساعة 12:00 منتصف الليل
    function getSecondsUntilMidnight() {
        const now = new Date();
        const midnight = new Date();
        midnight.setHours(24, 0, 0, 0);
        return Math.max(0, Math.floor((midnight - now) / 1000));
    }

    // تشغيل العداد التنازلي لمنتصف الليل
    function runMidnightTimer(domElements) {
        if (_timerInterval) clearInterval(_timerInterval);

        function tick() {
            const diffSeconds = getSecondsUntilMidnight();

            if (diffSeconds <= 0) {
                clearInterval(_timerInterval);
                renderUI(domElements);
                return;
            }

            const h = Math.floor(diffSeconds / 3600);
            const m = Math.floor((diffSeconds % 3600) / 60);
            const s = diffSeconds % 60;
            const formatted = `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;

            if (domElements.timerBox) {
                domElements.timerBox.innerText = `⏳ الهدية القادمة بعد: ${formatted}`;
            }
        }

        tick();
        _timerInterval = setInterval(tick, 1000);
    }

    // تحديث وتجهيز واجهة الستريك بعرض الصفحة
    function renderUI(domElements) {
        const now = new Date();
        const lastClaim = _userData?.last_daily_claim ? new Date(_userData.last_daily_claim) : null;
        const hasClaimedToday = lastClaim && isSameDay(lastClaim, now);

        if (domElements.streakCounter) {
            domElements.streakCounter.innerText = `${_userData?.streak || 0} يوم`;
        }

        if (hasClaimedToday) {
            if (domElements.claimBtn) {
                domElements.claimBtn.disabled = true;
                domElements.claimBtn.style.display = 'none';
            }
            if (domElements.timerBox) {
                domElements.timerBox.style.display = 'block';
            }
            if (domElements.wheelBtn) {
                domElements.wheelBtn.disabled = true;
                domElements.wheelBtn.innerText = "🎡 تم تدوير عجلة اليوم";
            }
            runMidnightTimer(domElements);
        } else {
            if (_timerInterval) clearInterval(_timerInterval);
            if (domElements.claimBtn) {
                domElements.claimBtn.disabled = false;
                domElements.claimBtn.style.display = 'block';
                domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+50 نقطة)";
            }
            if (domElements.timerBox) {
                domElements.timerBox.style.display = 'none';
            }
            if (domElements.wheelBtn) {
                domElements.wheelBtn.disabled = false;
                domElements.wheelBtn.innerText = "🎡 عجلة الحظ اليومية (جاهزة للّف)";
            }
        }
    }

    // الدالة التنفيذية للاستلام اليومي
    async function claimReward(domElements) {
        if (!domElements.claimBtn) return;
        domElements.claimBtn.disabled = true;
        domElements.claimBtn.innerText = "⏳ جاري المعالجة...";

        try {
            const { data: userCurrent, error } = await _client
                .from('users')
                .select('*')
                .eq('telegram_id', _tid)
                .single();

            if (error || !userCurrent) throw new Error("تعذر جلب البيانات");

            const now = new Date();
            if (userCurrent.last_daily_claim) {
                const lastClaim = new Date(userCurrent.last_daily_claim);
                if (isSameDay(lastClaim, now)) {
                    window.Telegram?.WebApp?.showAlert("⛔ لقد سجلت الدخول اليوم بالفعل!\nالمكافأة القادمة تتاح بعد منتصف الليل.");
                    _userData = userCurrent;
                    renderUI(domElements);
                    return;
                }
            }

            // احتساب السلسلة (هل حضر أمس؟)
            let newStreak = 1;
            if (userCurrent.last_daily_claim) {
                const lastClaim = new Date(userCurrent.last_daily_claim);
                if (isYesterday(lastClaim, now)) {
                    newStreak = (userCurrent.streak || 0) + 1;
                }
            }

            const nowIso = now.toISOString();
            const rewardPoints = 50;
            const newPoints = (userCurrent.points || 0) + rewardPoints;

            const { data: updated, error: updateErr } = await _client
                .from('users')
                .update({
                    points: newPoints,
                    streak: newStreak,
                    last_daily_claim: nowIso
                })
                .eq('telegram_id', _tid)
                .select()
                .single();

            if (updateErr) throw updateErr;

            _userData = updated;
            if (typeof _onUpdate === 'function') _onUpdate(updated);

            renderUI(domElements);
            window.Telegram?.WebApp?.showAlert(`🎉 مبروك! استلمت +${rewardPoints} نقطة.\n🔥 الستريك الحالي: ${newStreak} يوم متتالي!\nتفتح المكافأة القادمة غداً بعد 12:00 منتصف الليل.`);

        } catch (e) {
            console.error("Streak claim error:", e);
            domElements.claimBtn.disabled = false;
            domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+50 نقطة)";
            window.Telegram?.WebApp?.showAlert("❌ حدث خطأ أثناء الاتصال بالسيرفر.");
        }
    }

    return {
        init: function(client, tid, initialUser, domElements, onUpdateCallback) {
            _client = client;
            _tid = tid;
            _userData = initialUser;
            _onUpdate = onUpdateCallback;

            if (domElements.claimBtn) {
                domElements.claimBtn.onclick = () => claimReward(domElements);
            }

            renderUI(domElements);
        },
        updateUser: function(user, domElements) {
            _userData = user;
            renderUI(domElements);
        },
        openWheelModal: function() {
            window.Telegram?.WebApp?.showAlert("🎡 جاري تجهيز تفاصيل عجلة الحظ والجوائز بناءً على طلبك!");
        }
    };
})();
