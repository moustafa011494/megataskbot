/**
 * MegaTask - Streak & Monetag Official Integration
 * Zone ID: 10959333 (Rewarded Interstitial)
 */
const StreakManager = (function() {
    let _client = null;
    let _tid = null;
    let _onUpdate = null;
    let _userData = null;
    let _timerInterval = null;

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
                domElements.timerBox.innerText = `⏳ تتجدد المكافأة اليومية بعد: ${fmt}`;
            }
        }
        tick();
        _timerInterval = setInterval(tick, 1000);
    }

    function renderUI(domElements) {
        const now = new Date();
        const lastClaim = _userData?.last_daily_claim ? new Date(_userData.last_daily_claim) : null;
        const claimedToday = lastClaim && isSameDay(lastClaim, now);

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
                domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+50 نقطة)";
            }
            if (domElements.timerBox) domElements.timerBox.style.display = 'none';
        }
    }

    // تشغيل إعلان Monetag الرسمي واحتساب المكافأة
    function handleStreakClick(domElements) {
        const btn = domElements.claimBtn;

        // التأكد من تحميل SDK الخاص بمونيتاج
        if (typeof show_10959333 !== 'function') {
            window.Telegram?.WebApp?.showAlert("⚠️ جاري تحميل الإعلان، يرجى المحاولة بعد لحظة...");
            return;
        }

        btn.disabled = true;
        btn.innerText = "⏳ جاري تحميل الإعلان...";

        // استدعاء دالة الإعلان الرسمي
        show_10959333().then(async () => {
            // تنفيذ كود المكافأة بعد إتمام مشاهدة الإعلان
            btn.innerText = "⏳ جاري إضافة النقاط...";
            await executeStreakReward(domElements);
        }).catch((err) => {
            console.error("Monetag Ad Error:", err);
            btn.disabled = false;
            btn.innerText = "🎁 استلام مكافأة اليوم (+50 نقطة)";
            window.Telegram?.WebApp?.showAlert("❌ لم تكتمل مشاهدة الإعلان، يجب مشاهدته بالكامل للحصول على المكافأة!");
        });
    }

    // تسجيل المكافأة وتحديث السلسلة والوقت في Supabase
    async function executeStreakReward(domElements) {
        try {
            const { data: userCurrent, error: fetchErr } = await _client
                .from('users')
                .select('*')
                .eq('telegram_id', _tid)
                .single();

            if (fetchErr || !userCurrent) throw new Error("تعذر جلب البيانات");

            const now = new Date();
            let newStreak = 1;

            if (userCurrent.last_daily_claim) {
                const last = new Date(userCurrent.last_daily_claim);
                if (isSameDay(last, now)) {
                    window.Telegram?.WebApp?.showAlert("⛔ لقد استلمت مكافأة اليوم بالفعل!");
                    renderUI(domElements);
                    return;
                }
                if (isYesterday(last, now)) {
                    newStreak = (userCurrent.streak || 0) + 1;
                }
            }

            const updatedPoints = (userCurrent.points || 0) + 50;
            const nowIso = now.toISOString();

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
                window.Telegram?.WebApp?.showAlert(`🎉 مبروك! شاهدت الإعلان واستلمت +50 نقطة.\n🔥 الستريك: ${newStreak} أيام متتالية!\nتتجدد المكافأة بعد الساعة 12:00 منتصف الليل.`);
            } else {
                domElements.claimBtn.disabled = false;
                domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+50 نقطة)";
                window.Telegram?.WebApp?.showAlert("❌ حدث خطأ أثناء حفظ النقاط.");
            }
        } catch (e) {
            console.error("Execute reward error:", e);
            domElements.claimBtn.disabled = false;
            domElements.claimBtn.innerText = "🎁 استلام مكافأة اليوم (+50 نقطة)";
            window.Telegram?.WebApp?.showAlert("❌ تعذر الاتصال بالسيرفر.");
        }
    }

    return {
        init: function(client, tid, initialUser, domElements, onUpdateCallback) {
            _client = client;
            _tid = tid;
            _userData = initialUser;
            _onUpdate = onUpdateCallback;

            if (domElements.claimBtn) {
                domElements.claimBtn.onclick = () => handleStreakClick(domElements);
            }

            renderUI(domElements);
        }
    };
})();
