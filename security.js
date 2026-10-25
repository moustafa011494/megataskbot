/**
 * MegaTask - Ultimate Anti-VPN, Anti-Proxy, Anti-Spoofing & Anti-Multi-Account Shield v7.0 (security.js)
 */
const MegaSecurity = (function () {
    const S_URL = "https://smukfrwnguvmxvfwqwrv.supabase.co";
    const S_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtdWtmcnduZ3V2bXh2Zndxd3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MDg1NjgsImV4cCI6MjA4NTA4NDU2OH0.NUr7X5V7K-jarVLNm7Ft0dHo6QkIhhGYrkteRRb9wCM";
    const ADMIN_MASTER_ID = "875021647";
    const NET_CACHE_KEY = "megatask_net_check_v7";
    const NET_CACHE_TTL_MS = 15 * 60 * 1000;

    let _hardwareFp = null;
    let _deviceFp = null;
    let _userIp = null;
    let _alreadyChecked = false;

    const VPN_ISP_BLACKLIST = [
        "m247", "datacamp", "digitalocean", "hetzner", "ovh", "linode",
        "choopa", "vultr", "contabo", "leaseweb", "cdn77", "tzulo", "quadranet",
        "sharktech", "privax", "nord", "expressvpn", "proton", "surfshark", "cyberghost",
        "windscribe", "mullvad", "zenmate", "psiphon", "hotspot shield", "anchorfree",
        "pia", "private internet access", "vyprvpn", "tunnelbear", "hide.me",
        "ipvanish", "strongvpn", "astrill", "purevpn", "torguard", "airvpn", "ivpn",
        "perfect privacy", "goose vpn", "ultrasurf", "lantern", "packethub",
        "worldstream", "g-core", "gcore", "scaleway", "kamatera", "ionos",
        "upcloud", "hostinger", "hostwinds", "frantech", "buyvm", "ramnode", "time4vps",
        "melbicom", "aeza", "pq.hosting", "stark industries", "tefincom", "netprotect",
        "tor exit", "anonymizer"
    ];

    const TIMEZONE_TO_COUNTRY = {
        "africa/cairo": "EG",
        "asia/riyadh": "SA",
        "asia/baghdad": "IQ",
        "africa/casablanca": "MA",
        "africa/algiers": "DZ",
        "africa/tunis": "TN",
        "africa/tripoli": "LY",
        "asia/amman": "JO",
        "asia/damascus": "SY",
        "asia/beirut": "LB",
        "asia/gaza": "PS",
        "asia/hebron": "PS",
        "asia/dubai": "AE",
        "asia/kuwait": "KW",
        "asia/qatar": "QA",
        "asia/bahrain": "BH",
        "asia/muscat": "OM",
        "asia/aden": "YE",
        "africa/khartoum": "SD"
    };

    function isAdminPage() {
        return window.location.pathname.toLowerCase().includes("admin.html");
    }

    function generateHardwareSignature() {
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
            return "HW_" + Math.abs(hash).toString(36).toUpperCase();
        } catch (err) {
            return "HW_FALLBACK";
        }
    }

    function getOrCreateDeviceFingerprint() {
        const hw = generateHardwareSignature();
        _hardwareFp = hw;
        try {
            let localInstanceId = localStorage.getItem("megatask_device_instance_id");
            if (!localInstanceId) {
                localInstanceId = Math.random().toString(36).substring(2, 10).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
                localStorage.setItem("megatask_device_instance_id", localInstanceId);
            }
            return `${hw}_${localInstanceId}`;
        } catch (e) {
            return hw;
        }
    }

    async function detectIpAndVpnMultiLayer() {
        try {
            const cachedRaw = sessionStorage.getItem(NET_CACHE_KEY);
            if (cachedRaw) {
                const parsed = JSON.parse(cachedRaw);
                if (parsed && parsed.ts && (Date.now() - parsed.ts) < NET_CACHE_TTL_MS && !parsed.isVpn) {
                    return parsed;
                }
            }
        } catch (e) {}

        const deviceTz = (Intl.DateTimeFormat().resolvedOptions().timeZone || "").toLowerCase().trim();
        let detectedIp = null;
        let isVpn = false;
        let vpnReason = "";

        try {
            const fetchWithTimeout = (url, ms = 4500) => {
                const ctrl = new AbortController();
                const id = setTimeout(() => ctrl.abort(), ms);
                return fetch(url, { signal: ctrl.signal }).then(r => {
                    clearTimeout(id);
                    return r.json();
                });
            };

            const [whoRes, freeApiRes] = await Promise.allSettled([
                fetchWithTimeout("https://ipwho.is/"),
                fetchWithTimeout("https://freeipapi.com/api/json")
            ]);

            let ipCountry = "";
            let ipTz = "";
            let ispOrgText = "";

            if (whoRes.status === "fulfilled" && whoRes.value && whoRes.value.success !== false) {
                const d = whoRes.value;
                detectedIp = d.ip || detectedIp;
                ipCountry = (d.country_code || "").toUpperCase();
                ipTz = (d.timezone?.id || "").toLowerCase().trim();
                ispOrgText = `${d.connection?.isp || ""} ${d.connection?.org || ""} ${d.connection?.domain || ""}`.toLowerCase();

                if (d.security?.vpn || d.security?.proxy || d.security?.tor) {
                    isVpn = true;
                    vpnReason = `خادم VPN مباشر (${ipCountry})`;
                }
            }

            if (freeApiRes.status === "fulfilled" && freeApiRes.value) {
                const f = freeApiRes.value;
                if (!detectedIp && f.ipAddress) detectedIp = f.ipAddress;
                if (!ipCountry && f.countryCode) ipCountry = String(f.countryCode).toUpperCase();
                if (f.isProxy === true && !ispOrgText.includes("icloud")) {
                    isVpn = true;
                    vpnReason = `اتصال Proxy / VPN مكتشف (${ipCountry || f.countryName})`;
                }
            }

            if (!isVpn && ispOrgText) {
                for (const keyword of VPN_ISP_BLACKLIST) {
                    if (ispOrgText.includes(keyword)) {
                        isVpn = true;
                        vpnReason = `مزود خدمة غير مسموح (${keyword.toUpperCase()} - ${ipCountry})`;
                        break;
                    }
                }
            }

            if (!isVpn && deviceTz && ipCountry) {
                const expectedCountry = TIMEZONE_TO_COUNTRY[deviceTz];
                if (expectedCountry && expectedCountry !== ipCountry) {
                    isVpn = true;
                    vpnReason = `اختلاف موقع الشبكة (${ipCountry}) عن توقيت الهاتف (${expectedCountry})`;
                } else if (ipTz && deviceTz !== ipTz) {
                    const devContinent = deviceTz.split('/')[0];
                    const ipContinent = ipTz.split('/')[0];
                    if (devContinent && ipContinent && devContinent !== ipContinent) {
                        isVpn = true;
                        vpnReason = `تغيير موقع الاتصال (${ipTz} ⬅ ${deviceTz})`;
                    }
                }
            }

            const resultObj = { ip: detectedIp, isVpn: isVpn, reason: vpnReason, ts: Date.now() };
            try {
                sessionStorage.setItem(NET_CACHE_KEY, JSON.stringify(resultObj));
            } catch (e) {}
            return resultObj;
        } catch (err) {
            return { ip: detectedIp, isVpn: false, reason: "" };
        }
    }

    function showOutsideTelegramBlockScreen() {
        const stopAll = () => {
            document.body.innerHTML = `
                <div style="position:fixed; inset:0; background:#08090d; z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:22px; text-align:center; font-family:'Segoe UI',Tahoma,sans-serif; direction:rtl; user-select:none;">
                    <div style="background:#151821; border:2px solid #00f2ff; border-radius:24px; padding:28px 20px; max-width:365px; width:100%; box-shadow:0 0 50px rgba(0,242,255,0.25);">
                        <div style="font-size:54px; margin-bottom:10px;">🔒</div>
                        <h2 style="color:#00f2ff; margin:0 0 10px 0; font-size:19px;">منطقة محمية بتشفير تيليجرام</h2>
                        <p style="color:#d1d5db; font-size:13px; line-height:1.7; margin-bottom:18px;">
                            لحماية أرصدة المستخدمين ومنع انتحال الهوية، لا يُسمح بفتح المنصة من متصفح خارجي. يرجى فتحها من داخل البوت الرسمي فقط.
                        </p>
                        <a href="https://t.me/MegaTask1Bot" style="display:block; width:100%; background:linear-gradient(135deg,#00d26a,#009e4f); color:#000; text-decoration:none; padding:13px; border-radius:12px; font-weight:900; font-size:14px;">
                            🤖 فتح بوت MegaTask الرسمي
                        </a>
                    </div>
                </div>
            `;
        };
        stopAll();
        setTimeout(stopAll, 300);
    }

    function showVpnBlockScreen(reasonDetail, ipAddr) {
        try { sessionStorage.removeItem(NET_CACHE_KEY); } catch (e) {}
        const stopAll = () => {
            document.body.innerHTML = `
                <div style="position:fixed; inset:0; background:#08090d; z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:22px; text-align:center; font-family:'Segoe UI',Tahoma,sans-serif; direction:rtl; user-select:none;">
                    <div style="background:#151821; border:2px solid #ffaa00; border-radius:24px; padding:28px 20px; max-width:365px; width:100%; box-shadow:0 0 50px rgba(255,170,0,0.35);">
                        <div style="font-size:56px; margin-bottom:10px;">🛡️</div>
                        <h2 style="color:#ffaa00; margin:0 0 10px 0; font-size:20px;">تم اكتشاف اتصال VPN / Proxy!</h2>
                        <p style="color:#d1d5db; font-size:13px; line-height:1.7; margin-bottom:14px;">
                            عذراً، استخدام برامج الـ VPN أو تغيير الموقع الجغرافي أو تطبيقات البروكسي محظور تماماً على منصة MegaTask.
                        </p>
                        <div style="background:#0c0e13; border:1px dashed #ffaa00; border-radius:12px; padding:12px; font-size:11.5px; color:#9ca3af; margin-bottom:16px; line-height:1.8;">
                            🔍 <b style="color:#ffaa00;">تفاصيل الفحص الأمني:</b><br>
                            <span style="color:#fff;">${reasonDetail || 'اتصال عبر خادم افتراضي'}</span><br>
                            ${ipAddr ? `<span style="color:#888; font-family:monospace;">IP: ${ipAddr}</span>` : ''}
                        </div>
                        <p style="font-size:12px; color:#00d26a; font-weight:bold; margin:0 0 14px 0;">
                            💡 أوقف تشغيل الـ VPN من هاتفك ثم اضغط إعادة الفحص:
                        </p>
                        <button onclick="sessionStorage.removeItem('${NET_CACHE_KEY}'); location.reload();" style="width:100%; background:#ffaa00; color:#000; border:none; padding:12px; border-radius:12px; font-weight:bold; font-size:14px; cursor:pointer;">
                            🔄 أوقفت الـ VPN - إعادة الفحص الآن
                        </button>
                    </div>
                </div>
            `;
        };
        stopAll();
        setTimeout(stopAll, 350);
    }

    function showPermanentBanScreen(primaryAccountId, currentAccountId, customReason) {
        const stopAll = () => {
            document.body.innerHTML = `
                <div style="position:fixed; inset:0; background:#08090d; z-index:2147483647; display:flex; align-items:center; justify-content:center; padding:22px; text-align:center; font-family:'Segoe UI',Tahoma,sans-serif; direction:rtl; user-select:none;">
                    <div style="background:#151821; border:2px solid #ff3b30; border-radius:24px; padding:28px 20px; max-width:360px; width:100%; box-shadow:0 0 50px rgba(255,59,48,0.35);">
                        <div style="font-size:56px; margin-bottom:10px;">🚫</div>
                        <h2 style="color:#ff4d4d; margin:0 0 10px 0; font-size:20px;">تم حظر الوصول لهذا الحساب!</h2>
                        <p style="color:#d1d5db; font-size:13px; line-height:1.7; margin-bottom:16px;">
                            ${customReason || 'تم اكتشاف فتح أكثر من حساب من نفس الهاتف. يُسمح بحساب واحد فقط لكل جهاز على منصة MegaTask.'}
                        </p>
                        <div style="background:#0c0e13; border:1px dashed #ff3b30; border-radius:12px; padding:12px; font-size:12px; color:#9ca3af; margin-bottom:16px; line-height:1.9;">
                            ✅ <b style="color:#00d26a;">الحساب الأساسي المسجل لهذا الجهاز:</b><br>
                            <span style="color:white; font-family:monospace; font-size:14px;">ID: ${primaryAccountId}</span><br>
                            ❌ <b style="color:#ff4d4d;">الحساب الموقوف حالياً:</b><br>
                            <span style="color:#ff7b72; font-family:monospace; font-size:14px;">ID: ${currentAccountId}</span>
                        </div>
                    </div>
                </div>
            `;
        };
        stopAll();
        setTimeout(stopAll, 350);
    }

    function pickMasterAccount(matchedUsers, currentUser) {
        const adminAcc = matchedUsers.find(u => String(u.telegram_id) === ADMIN_MASTER_ID);
        if (adminAcc) return adminAcc;

        const savedLocalMaster = localStorage.getItem("megatask_master_owner_id");
        if (savedLocalMaster) {
            const localMasterAcc = matchedUsers.find(u => String(u.telegram_id) === String(savedLocalMaster) && u.is_banned !== true);
            if (localMasterAcc) return localMasterAcc;
        }

        if (currentUser && currentUser.referred_by) {
            const inviterAcc = matchedUsers.find(u => String(u.telegram_id) === String(currentUser.referred_by));
            if (inviterAcc) return inviterAcc;
        }

        const unbannedList = matchedUsers.filter(u => u.is_banned !== true);
        const pool = unbannedList.length > 0 ? unbannedList : matchedUsers;
        pool.sort((a, b) => {
            const tasksDiff = Number(b.total_tasks || 0) - Number(a.total_tasks || 0);
            if (tasksDiff !== 0) return tasksDiff;
            return Number(b.points || 0) - Number(a.points || 0);
        });
        return pool[0];
    }

    // استخراج صارم لهوية المستخدم من جلسة تليجرام الموقعة ومنع التزوير عبر الرابط (?id=)
    function getVerifiedUserId(passedTid) {
        const tgApp = window.Telegram?.WebApp;
        const tgUserId = tgApp?.initDataUnsafe?.user?.id;
        const tgInitData = tgApp?.initData || "";
        const urlId = new URLSearchParams(window.location.search).get('id');

        if (tgUserId) {
            const realIdStr = String(tgUserId).trim();
            if (urlId && String(urlId).trim() !== realIdStr) {
                try {
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('id', realIdStr);
                    window.history.replaceState({}, '', newUrl.toString());
                } catch (e) {}
            }
            try {
                localStorage.setItem('telegram_id', realIdStr);
                localStorage.setItem('megatask_uid', realIdStr);
                if (tgInitData) {
                    sessionStorage.setItem('megatask_tg_init_data', tgInitData);
                }
            } catch (e) {}
            return realIdStr;
        }

        // السماح بالتنقل الداخلي بين الصفحات إذا كانت جلسة تليجرام موثقة في نفس الجلسة (sessionStorage)
        const cachedSessionInitData = sessionStorage.getItem('megatask_tg_init_data');
        const savedTid = localStorage.getItem('telegram_id') || localStorage.getItem('megatask_uid');
        if (cachedSessionInitData && savedTid) {
            return String(savedTid).replace(/[^\d]/g, "");
        }

        // إذا لم تكن صفحة الأدمن وتم فتحها من متصفح عادي خارج تليجرام، نمنع انتحال الـ ID
        if (!isAdminPage()) {
            return "";
        }

        const rawFallback = String(passedTid || urlId || savedTid || "").trim();
        return rawFallback.replace(/[^\d]/g, "");
    }

    function getTelegramInitData() {
        return window.Telegram?.WebApp?.initData || sessionStorage.getItem('megatask_tg_init_data') || "";
    }

    async function verifyDeviceAndAccount(supabaseClient, passedTid) {
        try {
            const currentTid = getVerifiedUserId(passedTid);

            if (!currentTid && !isAdminPage()) {
                showOutsideTelegramBlockScreen();
                return { allowed: false, reason: "outside_telegram" };
            }

            _deviceFp = getOrCreateDeviceFingerprint();
            const netCheck = await detectIpAndVpnMultiLayer();
            _userIp = netCheck.ip;

            if (netCheck.isVpn && currentTid !== ADMIN_MASTER_ID) {
                showVpnBlockScreen(netCheck.reason, _userIp);
                return { allowed: false, reason: "vpn_detected" };
            }

            if (!currentTid || currentTid === "undefined" || currentTid === "null") {
                return { allowed: true };
            }

            const boundMasterId = localStorage.getItem("megatask_master_owner_id");
            if (boundMasterId && boundMasterId !== currentTid && currentTid !== ADMIN_MASTER_ID && boundMasterId !== "123456789") {
                showPermanentBanScreen(boundMasterId, currentTid, "هذا الهاتف مسجل ومربوط مسبقاً بحساب أساسي آخر. لا يُسمح بفتح حسابات متعددة على نفس الجهاز!");
                return { allowed: false, reason: "local_device_bound_to_other" };
            }

            const db = supabaseClient || (window.supabase ? window.supabase.createClient(S_URL, S_KEY) : null);
            if (!db) return { allowed: true };

            const { data: myUser } = await db
                .from('users')
                .select('telegram_id, name, points, total_tasks, device_fp, last_ip, is_banned, referred_by')
                .eq('telegram_id', currentTid)
                .maybeSingle();

            if (!myUser) return { allowed: true };

            if (myUser.is_banned === true && currentTid !== ADMIN_MASTER_ID) {
                showPermanentBanScreen(myUser.referred_by || boundMasterId || "حساب آخر على نفس الهاتف", currentTid, "تم إيقاف هذا الحساب من قِبل نظام الحماية أو الإدارة.");
                return { allowed: false, reason: "already_banned" };
            }

            let matchedUsers = [];
            if (_deviceFp && !_deviceFp.startsWith("HW_FALLBACK")) {
                const { data: fpMatches } = await db
                    .from('users')
                    .select('telegram_id, name, points, total_tasks, device_fp, last_ip, is_banned, referred_by')
                    .eq('device_fp', _deviceFp);
                if (fpMatches) matchedUsers.push(...fpMatches);
            }

            const uniqueMap = {};
            matchedUsers.forEach(u => { uniqueMap[String(u.telegram_id)] = u; });
            uniqueMap[currentTid] = myUser;
            const allSameDeviceUsers = Object.values(uniqueMap);

            if (allSameDeviceUsers.length > 1) {
                const masterAccount = pickMasterAccount(allSameDeviceUsers, myUser);
                const masterId = String(masterAccount.telegram_id);

                if (currentTid !== masterId && currentTid !== ADMIN_MASTER_ID) {
                    const hadRef = myUser.referred_by;

                    await db.from('users').update({
                        device_fp: _deviceFp,
                        last_ip: _userIp || myUser.last_ip,
                        is_banned: true,
                        referred_by: null
                    }).eq('telegram_id', currentTid);

                    if (hadRef) {
                        await db.from('bot_messages').insert([{
                            telegram_id: masterId,
                            message: `🚫 *تنبيه أمني من نظام الحماية:*\n\nتم اكتشاف محاولة فتح حساب فرعي (\`${currentTid}\`) من نفس هاتفك.\n❌ تم حظر الحساب الفرعي وإلغاء احتساب الإحالة تلقائياً.`,
                            status: 'pending'
                        }]);
                    }

                    localStorage.setItem("megatask_master_owner_id", masterId);
                    showPermanentBanScreen(masterId, currentTid);
                    return { allowed: false, reason: "multi_account_detected" };
                }
            }

            localStorage.setItem("megatask_master_owner_id", currentTid);
            const updatePayload = { device_fp: _deviceFp };
            if (_userIp && !netCheck.isVpn) updatePayload.last_ip = _userIp;

            await db.from('users').update(updatePayload).eq('telegram_id', currentTid);
            return { allowed: true, fp: _deviceFp, ip: _userIp, verifiedTid: currentTid };

        } catch (err) {
            console.error("MegaSecurity Error:", err);
            return { allowed: true };
        }
    }

    async function canAcceptReferral(supabaseClient, myTid, inviterTid) {
        const cleanMyTid = getVerifiedUserId(myTid);
        if (!inviterTid || String(cleanMyTid) === String(inviterTid)) {
            return { ok: false, msg: "❌ لا يمكنك استخدام كود الدعوة الخاص بك!" };
        }

        const myFp = _deviceFp || getOrCreateDeviceFingerprint();
        const myHwPrefix = myFp.split('_').slice(0, 2).join('_');
        const netCheck = await detectIpAndVpnMultiLayer();
        const myIp = _userIp || netCheck.ip;

        if (netCheck.isVpn && String(cleanMyTid) !== ADMIN_MASTER_ID) {
            showVpnBlockScreen(netCheck.reason, myIp);
            return { ok: false, msg: "🚫 لا يمكنك تفعيل دعوات أثناء تشغيل الـ VPN!" };
        }

        const { data: inviter } = await supabaseClient
            .from('users')
            .select('telegram_id, name, device_fp, last_ip, referred_by')
            .eq('telegram_id', String(inviterTid))
            .maybeSingle();

        if (!inviter) {
            return { ok: false, msg: "❌ كود الدعوة هذا غير مسجل في النظام!" };
        }

        if (String(inviter.referred_by || "") === String(cleanMyTid)) {
            return { ok: false, msg: "🚫 لا يمكنك تفعيل كود دعوة لشخص مسجل تحت دعوتك!" };
        }

        if (inviter.device_fp && myFp && inviter.device_fp === myFp) {
            return { ok: false, msg: "🚫 مرفوض! صاحب كود الدعوة يستخدم نفس هذا الهاتف. يُمنع عمل دعوات لنفسك!" };
        }

        if (inviter.last_ip && myIp && inviter.last_ip === myIp) {
            return { ok: false, msg: "🚫 مرفوض! لا يمكن تفعيل كود دعوة لحساب متصل من نفس شبكة الإنترنت!" };
        }

        if (inviter.device_fp && myHwPrefix && inviter.device_fp.startsWith(myHwPrefix) && inviter.last_ip === myIp) {
            return { ok: false, msg: "🚫 مرفوض! تم اكتشاف محاولة إحالة ذاتية من نفس الجهاز." };
        }

        return { ok: true, inviter: inviter };
    }

    window.addEventListener('DOMContentLoaded', () => {
        if (!_alreadyChecked) {
            _alreadyChecked = true;
            verifyDeviceAndAccount(null, null);
        }
    });

    return {
        verifyDeviceAndAccount: verifyDeviceAndAccount,
        canAcceptReferral: canAcceptReferral,
        getVerifiedUserId: getVerifiedUserId,
        getTelegramInitData: getTelegramInitData
    };
})();
