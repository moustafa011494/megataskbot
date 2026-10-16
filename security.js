/**
 * MegaTask - Anti-Multi-Account & Anti-Self-Referral Shield (security.js)
 */
const MegaSecurity = (function () {
    let _deviceFp = null;
    let _userIp = null;

    // 1. توليد بصمة الهاردوير الفريدة للهاتف (Canvas + WebGL GPU + Screen + CPU)
    function generateHardwareFingerprint() {
        try {
            const components = [];

            // مواصفات الشاشة والعتاد
            components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
            components.push(`dpr:${window.devicePixelRatio || 1}`);
            components.push(`cores:${navigator.hardwareConcurrency || 0}`);
            components.push(`mem:${navigator.deviceMemory || 0}`);
            components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone || ''}`);
            components.push(`plat:${navigator.platform || ''}`);

            // بصمة كارت الشاشة (WebGL Renderer)
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

            // بصمة رسم الـ Canvas
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

            // تحويل البصمة إلى كود Hash ثابت
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

    // 2. جلب عنوان الـ IP الحقيقي للمستخدم
    async function fetchUserIp() {
        try {
            const res = await fetch("https://api.ipify.org?format=json");
            const data = await res.json();
            return data.ip || null;
        } catch (e) {
            return null;
        }
    }

    // 3. إظهار شاشة الحظر الكاملة إذا حاول فتح حساب ثانٍ على نفس الهاتف
    function showMultiAccountBlockScreen(primaryAccountId, currentAccountId, reasonText) {
        const blockHtml = `
            <div id="multi-account-blocker" style="position:fixed; inset:0; background:#090b0f; z-index:9999999; display:flex; align-items:center; justify-content:center; padding:22px; text-align:center; font-family:'Segoe UI',Tahoma,sans-serif; direction:rtl;">
                <div style="background:#161922; border:2px solid #ff3b30; border-radius:24px; padding:28px 20px; max-width:360px; width:100%; box-shadow:0 0 40px rgba(255,59,48,0.25);">
                    <div style="font-size:54px; margin-bottom:10px;">🚫</div>
                    <h2 style="color:#ff4d4d; margin:0 0 10px 0; font-size:20px;">تم اكتشاف تعدد حسابات!</h2>
                    <p style="color:#d1d5db; font-size:13px; line-height:1.7; margin-bottom:16px;">
                        ${reasonText || 'عذراً، هذا الهاتف مربوط بالفعل بحساب أساسي آخر على منصة MegaTask. يُمنع فتح أكثر من حساب على نفس الهاتف لمنع التلاعب بالإحالات والإعلانات.'}
                    </p>
                    <div style="background:#0d0f14; border:1px dashed #ff3b30; border-radius:12px; padding:12px; font-size:12px; color:#9ca3af; margin-bottom:16px; line-height:1.8;">
                        ✅ <b style="color:#00d26a;">الحساب الأساسي المسموح له على هذا الهاتف:</b><br>
                        <span style="color:white; font-family:monospace; font-size:14px;">ID: ${primaryAccountId}</span><br>
                        ❌ <b style="color:#ff4d4d;">الحساب الحالي المرفوض:</b><br>
                        <span style="color:#aaa; font-family:monospace;">ID: ${currentAccountId}</span>
                    </div>
                    <p style="font-size:11px; color:#ffaa00; margin:0;">
                        💡 يرجى العودة لحسابك الأساسي (${primaryAccountId}) لمتابعة استخدام البوت بشكل طبيعي.
                    </p>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', blockHtml);
    }

    return {
        // فحص الجهاز عند فتح أي صفحة في البوت
        verifyDeviceAndAccount: async function (supabaseClient, currentTid) {
            // 1. التأكد من أن الـ ID حقيقي من تليجرام وليس متلاعباً به من الرابط
            const realTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
            if (realTgId && String(realTgId) !== String(currentTid)) {
                currentTid = String(realTgId);
            }

            if (!currentTid || currentTid === "123456789") return { allowed: true };

            _deviceFp = generateHardwareFingerprint();
            _userIp = await fetchUserIp();

            // 2. فحص القفل المحلي على الهاتف (Local Master Lock)
            const localMasterId = localStorage.getItem("megatask_master_owner_id");
            if (localMasterId && String(localMasterId) !== String(currentTid)) {
                showMultiAccountBlockScreen(localMasterId, currentTid);
                return { allowed: false, reason: "local_device_mismatch" };
            }

            try {
                // 3. فحص الداتابيز: هل توجد حسابات أخرى مسجلة بنفس بصمة الهاردوير (device_fp)؟
                if (_deviceFp && _deviceFp !== "FP_FALLBACK") {
                    const { data: sameDeviceUsers } = await supabaseClient
                        .from('users')
                        .select('telegram_id, created_at')
                        .eq('device_fp', _deviceFp)
                        .order('id', { ascending: true });

                    if (sameDeviceUsers && sameDeviceUsers.length > 0) {
                        const firstOwnerId = String(sameDeviceUsers[0].telegram_id);
                        if (firstOwnerId !== String(currentTid)) {
                            // حفظ الحساب الأصلي في ذاكرة الهاتف ومنع الحساب الثاني فوراً!
                            localStorage.setItem("megatask_master_owner_id", firstOwnerId);
                            showMultiAccountBlockScreen(firstOwnerId, currentTid);
                            return { allowed: false, reason: "db_fingerprint_mismatch" };
                        }
                    }
                }

                // 4. إذا كان الجهاز سليماً وهو المالك الأصلي، نختم الجهاز باسمه ونحدث بصمته والـ IP
                localStorage.setItem("megatask_master_owner_id", String(currentTid));

                const updatePayload = { device_fp: _deviceFp };
                if (_userIp) updatePayload.last_ip = _userIp;

                await supabaseClient
                    .from('users')
                    .update(updatePayload)
                    .eq('telegram_id', String(currentTid));

                return { allowed: true, fp: _deviceFp, ip: _userIp };
            } catch (e) {
                console.error("Security check error:", e);
                return { allowed: true };
            }
        },

        // فحص إضافي صارم عند محاولة تفعيل كود دعوة (يمنع دعوة النفس من نفس الفون أو نفس الـ IP)
        canAcceptReferral: async function (supabaseClient, myTid, inviterTid) {
            if (!inviterTid || String(myTid) === String(inviterTid)) {
                return { ok: false, msg: "❌ لا يمكنك استخدام كود الدعوة الخاص بك!" };
            }

            const localMasterId = localStorage.getItem("megatask_master_owner_id");
            if (localMasterId && String(localMasterId) === String(inviterTid)) {
                return { ok: false, msg: "🚫 تم كشف محاولة إحالة ذاتية من نفس الهاتف! لا يمكن دعوة نفسك." };
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

            // فحص تطابق بصمة الهاتف بين الداعي والمدعو
            if (inviter.device_fp && myFp && inviter.device_fp === myFp) {
                return { ok: false, msg: "🚫 مرفوض! صاحب كود الدعوة يستخدم نفس هذا الهاتف. يُمنع عمل دعوات لنفسك!" };
            }

            // فحص تطابق الـ IP (نفس الراوتر / نفس شبكة الهاتف لحظة التسجيل)
            if (inviter.last_ip && myIp && inviter.last_ip === myIp) {
                return { ok: false, msg: "🚫 مرفوض! لا يمكن تفعيل كود دعوة لحساب متصل من نفس شبكة الإنترنت / نفس الجهاز!" };
            }

            return { ok: true, inviter: inviter };
        }
    };
})();
