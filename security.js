/**
 * MegaTask - Anti-Multi-Account & Anti-Self-Referral Shield v2.0 (security.js)
 * يعمل تلقائياً ويحظر الحسابات المكررة ويلغي الإحالات الذاتية من قاعدة البيانات فوراً
 */
const MegaSecurity = (function () {
    const S_URL = "https://smukfrwnguvmxvfwqwrv.supabase.co";
    const S_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdWtmcnduZ3V2bXh2Zndxd3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDg1NjgsImV4cCI6MjA4NTA4NDU2OH0.NUr7X5V7K-jarVLNm7Ft0dHo6QkIhhGYrkteRRb9wCM";
    const ADMIN_MASTER_ID = "875021647"; // حماية مطلقة لحساب الأدمن الأساسي

    let _deviceFp = null;
    let _userIp = null;
    let _alreadyChecked = false;

    // 1. توليد بصمة الهاردوير الفريدة للهاتف
    function generateHardwareFingerprint() {
        try {
            const components = [];
            components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
            components.push(`dpr:${window.devicePixelRatio || 1}`);
            components.push(`cores:${navigator.hardwareConcurrency || 0}`);
            components.push(`mem:${navigator.deviceMemory || 0}`);
            components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`);
            components.push(`plat:${navigator.platform || ''}`);

            try {
                const glCanvas = document.createElement('canvas');
                const gl = glCanvas.getContext('webgl') || glCanvas.getContext('experimental-webgl');
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        components.push(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
                        components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
                    }
                }
            } catch (e) {}

            try {
                const canvas = document.createElement('canvas');
                canvas.width = 220;
                canvas.height = 40;
                const ctx = canvas.getContext('2d');
                ctx.textBaseline = "top";
                ctx.font = "14px 'Arial'";
                ctx.fillStyle = "#f60";
                ctx.fillRect(10, 1, 62, 20);
                ctx.fillStyle = "#069";
                ctx.fillText("MegaTask_FP_Shield_99", 2, 15);
                components.push(canvas.toDataURL().slice(-60));
            } catch (e) {}

            const rawStr = components.join('||');
            let hash = 0;
            for (let i = 0; i < rawStr.length; i++) {
                const chr = rawStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + chr;
                hash |= 0;
            }
            return "FP_" + Math.abs(hash).toString(36).toUpperCase();
        } catch (err) {
            return "FP_FALLBACK";
        }
    }

    // 2. جلب الـ IP الحقيقي مع مهلة أمان سريعة (2.5 ثانية)
    async function fetchUserIp() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const res = await fetch("https://api.ipify.org?format=json", { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            return data.ip || null;
        } catch (e) {
            return null;
        }
    }

    // 3. قفل الشاشة بالكامل ومنع التفاعل عند اكتشاف حساب مكرر
    function showPermanentBanScreen(primaryAccountId, currentAccountId, reasonText) {
        const stopAll = () => {
            document.body.innerHTML = `
                <div style="position:fixed; inset:0; background:#08090d; z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:22px; text-align:center; font-family:'Segoe UI',Tahoma,sans-serif; direction:rtl; user-select:none;">
                    <div style="background:#151821; border:2px solid #ff3b30; border-radius:24px; padding:28px 20px; max-width:360px; width:100%; box-shadow:0 0 50px rgba(255,59,48,0.35);">
                        <div style="font-size:56px; margin-bottom:10px;">🚫</div>
                        <h2 style="color:#ff4d4d; margin:0 0 10px 0; font-size:20px;">تم حظر هذا الحساب الفرعي!</h2>
                        <p style="color:#d1d5db; font-size:13px; line-height:1.7; margin-bottom:16px;">
                            ${reasonText || 'تم اكتشاف فتح أكثر من حساب من نفس الهاتف أو نفس شبكة الإنترنت. تم حظر هذا الحساب وإلغاء الإحالة تلقائياً.'}
                        </p>
                        <div style="background:#0c0e13; border:1px dashed #ff3b30; border-radius:12px; padding:12px; font-size:12px; color:#9ca3af; margin-bottom:16px; line-height:1.9;">
                            ✅ <b style="color:#00d26a;">الحساب الأساسي المسجل لهذا الجهاز:</b><br>
                            <span style="color:white; font-family:monospace; font-size:14px;">ID: ${primaryAccountId}</span><br>
                            ❌ <b style="color:#ff4d4d;">الحساب المحظور حالياً:</b><br>
                            <span style="color:#ff7b72; font-family:monospace; font-size:14px;">ID: ${currentAccountId}</span>
                        </div>
                        <p style="font-size:11.5px; color:#ffaa00; margin:0; line-height:1.6;">
                            ⚠️ يُسمح بحساب واحد فقط لكل هاتف. يرجى فتح البوت من حسابك الأساسي (${primaryAccountId}) فقط.
                        </p>
                    </div>
                </div>
            `;
        };
        stopAll();
        setTimeout(stopAll, 400);
    }

    // 4. تحديد من هو صاحب الجهاز الأصلي ومن هو الحساب المكرر
    function pickMasterAccount(matchedUsers, currentUser) {
        // 1. إذا كان الأدمن من ضمن الحسابات، فهو دائماً الحساب الأصلي
        const adminAcc = matchedUsers.find(u => String(u.telegram_id) === ADMIN_MASTER_ID);
        if (adminAcc) return adminAcc;

        // 2. إذا كان الحساب الحالي مدعواً بواسطة أحد الحسابات المطابقة، فالداعي هو الحساب الأصلي!
        if (currentUser && currentUser.referred_by) {
            const inviterAcc = matchedUsers.find(u => String(u.telegram_id) === String(currentUser.referred_by));
            if (inviterAcc) return inviterAcc;
        }

        // 3. الحساب غير المحظور الذي يمتلك مهام أكثر أو نقاط أكثر هو الأصلي
        const unbannedList = matchedUsers.filter(u => u.is_banned !== true);
        const pool = unbannedList.length > 0 ? unbannedList : matchedUsers;

        pool.sort((a, b) => {
            const tasksDiff = Number(b.total_tasks || 0) - Number(a.total_tasks || 0);
            if (tasksDiff !== 0) return tasksDiff;
            return Number(b.points || 0) - Number(a.points || 0);
        });

        return pool[0];
    }

    // 5. الفحص الرئيسي الشامل
    async function verifyDeviceAndAccount(supabaseClient, passedTid) {
        try {
            const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
            const urlId = new URLSearchParams(window.location.search).get('id');
            const currentTid = String(tgId || passedTid || urlId || localStorage.getItem('telegram_id') || "").trim();

            if (!currentTid || currentTid === "undefined" || currentTid === "null") {
                return { allowed: true };
            }

            const db = supabaseClient || (window.supabase ? window.supabase.createClient(S_URL, S_KEY) : null);
            if (!db) return { allowed: true };

            _deviceFp = generateHardwareFingerprint();
            _userIp = await fetchUserIp();

            // جلب بيانات الحساب الحالي من الداتابيز
            const { data: myUser } = await db
                .from('users')
                .select('telegram_id, name, points, total_tasks, device_fp, last_ip, is_banned, referred_by')
                .eq('telegram_id', currentTid)
                .maybeSingle();

            if (!myUser) return { allowed: true };

            // إذا كان الحساب محظوراً مسبقاً في الداتابيز (ومش حساب الأدمن) نقفل فوراً
            if (myUser.is_banned === true && currentTid !== ADMIN_MASTER_ID) {
                showPermanentBanScreen(myUser.referred_by || "حساب آخر على نفس الهاتف", currentTid);
                return { allowed: false, reason: "already_banned" };
            }

            // البحث عن أي حسابات أخرى تشترك في نفس بصمة الهاتف (device_fp) أو نفس الـ IP (last_ip)
            let matchedUsers = [];

            if (_deviceFp && _deviceFp !== "FP_FALLBACK") {
                const { data: fpMatches } = await db
                    .from('users')
                    .select('telegram_id, name, points, total_tasks, device_fp, last_ip, is_banned, referred_by')
                    .eq('device_fp', _deviceFp);
                if (fpMatches) matchedUsers.push(...fpMatches);
            }

            if (_userIp) {
                const { data: ipMatches } = await db
                    .from('users')
                    .select('telegram_id, name, points, total_tasks, device_fp, last_ip, is_banned, referred_by')
                    .eq('last_ip', _userIp);
                if (ipMatches) matchedUsers.push(...ipMatches);
            }

            // إزالة التكرار من القائمة
            const uniqueMap = {};
            matchedUsers.forEach(u => { uniqueMap[String(u.telegram_id)] = u; });
            uniqueMap[currentTid] = myUser;
            const allSameDeviceUsers = Object.values(uniqueMap);

            // إذا وجدنا أكثر من حساب على نفس البصمة أو نفس الـ IP!
            if (allSameDeviceUsers.length > 1) {
                const masterAccount = pickMasterAccount(allSameDeviceUsers, myUser);
                const masterId = String(masterAccount.telegram_id);

                // إذا كان الحساب المفتوح حالياً ليس هو الحساب الأصلي -> نحظره فوراً ونلغي إحالته!
                if (currentTid !== masterId && currentTid !== ADMIN_MASTER_ID) {
                    const hadRef = myUser.referred_by;

                    await db.from('users').update({
                        device_fp: _deviceFp,
                        last_ip: _userIp || myUser.last_ip,
                        is_banned: true,
                        referred_by: null, // إلغاء الإحالة الوهمية فوراً
                        points: 0          // سحب هدية التسجيل الوهمية
                    }).eq('telegram_id', currentTid);

                    // إرسال تنبيه في شات البوت بإلغاء الإحالة وحظر الحساب الفرعي
                    if (hadRef) {
                        await db.from('bot_messages').insert([{
                            telegram_id: masterId,
                            message: `🚫 *تنبيه أمني من نظام الحماية:*\n\nتم اكتشاف محاولة فتح حساب فرعي (\`${currentTid}\`) من نفس هاتفك أو نفس شبكة الإنترنت الخاصة بك.\n❌ تم حظر الحساب الفرعي وإلغاء احتساب الإحالة تلقائياً.`,
                            status: 'pending'
                        }]);
                    }

                    localStorage.setItem("megatask_master_owner_id", masterId);
                    showPermanentBanScreen(masterId, currentTid);
                    return { allowed: false, reason: "multi_account_detected" };
                }

                // أما إذا كان المفتوح حالياً هو الحساب الأصلي (مثل الأدمن)، نتأكد من حظر الحسابات الفرعية الأخرى في الخلفية!
                for (const other of allSameDeviceUsers) {
                    const otherId = String(other.telegram_id);
                    if (otherId !== masterId && otherId !== ADMIN_MASTER_ID && (other.is_banned !== true || other.referred_by)) {
                        await db.from('users').update({
                            is_banned: true,
                            referred_by: null,
                            points: 0
                        }).eq('telegram_id', otherId);
                    }
                }
            }

            // تحديث بصمة الحساب الأصلي والـ IP في الداتابيز
            localStorage.setItem("megatask_master_owner_id", currentTid);
            const updatePayload = { device_fp: _deviceFp };
            if (_userIp) updatePayload.last_ip = _userIp;

            await db.from('users').update(updatePayload).eq('telegram_id', currentTid);
            return { allowed: true, fp: _deviceFp, ip: _userIp };

        } catch (err) {
            console.error("MegaSecurity Error:", err);
            return { allowed: true };
        }
    }

    // 6. فحص إضافي عند محاولة كتابة كود دعوة يدوياً داخل البوت
    async function canAcceptReferral(supabaseClient, myTid, inviterTid) {
        if (!inviterTid || String(myTid) === String(inviterTid)) {
            return { ok: false, msg: "❌ لا يمكنك استخدام كود الدعوة الخاص بك!" };
        }

        const myFp = _deviceFp || generateHardwareFingerprint();
        const myIp = _userIp || (await fetchUserIp());

        const { data: inviter } = await supabaseClient
            .from('users')
            .select('telegram_id, name, device_fp, last_ip')
            .eq('telegram_id', String(inviterTid))
            .maybeSingle();

        if (!inviter) {
            return { ok: false, msg: "❌ كود الدعوة هذا غير مسجل في النظام!" };
        }

        if (inviter.device_fp && myFp && inviter.device_fp === myFp) {
            return { ok: false, msg: "🚫 مرفوض! صاحب كود الدعوة يستخدم نفس هذا الهاتف. يُمنع عمل دعوات لنفسك!" };
        }

        if (inviter.last_ip && myIp && inviter.last_ip === myIp) {
            return { ok: false, msg: "🚫 مرفوض! لا يمكن تفعيل كود دعوة لحساب متصل من نفس شبكة الإنترنت!" };
        }

        return { ok: true, inviter: inviter };
    }

    // ⚡ تشغيل تلقائي بمجرد تحميل أي صفحة موجود فيها security.js
    window.addEventListener('DOMContentLoaded', () => {
        if (!_alreadyChecked) {
            _alreadyChecked = true;
            verifyDeviceAndAccount(null, null);
        }
    });

    return {
        verifyDeviceAndAccount: verifyDeviceAndAccount,
        canAcceptReferral: canAcceptReferral
    };
})();
