/**
 * Migration Script: Di chuyển data cũ từ /devices, /rooms, /members, /alerts
 * sang cấu trúc mới: /homes/{homeId}/...
 *
 * Cách chạy:
 *   1. Mở Firebase Console > Realtime Database > Export JSON > lưu thành backup.json
 *   2. cd smart-home-app
 *   3. npx ts-node --project tsconfig.json src/scripts/migrateLegacyData.ts
 *
 * Hoặc chạy trong Node.js môi trường thủ công:
 *   node -e "require('./dist/scripts/migrateLegacyData.js').runMigration()"
 *
 * YÊU CẦU: Biến môi trường EXPO_PUBLIC_FIREBASE_DATABASE_URL và EXPO_PUBLIC_FIREBASE_API_KEY
 * phải được thiết lập, HOẶC chỉnh hardcode bên dưới.
 *
 * QUAN TRỌNG: Script này KHÔNG xóa data cũ. Chỉ copy sang cấu trúc mới.
 * Sau khi verify, tự xóa /devices, /rooms, /members, /alerts cũ qua Firebase Console.
 */

const FIREBASE_DB_URL = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL || '';
const FIREBASE_API_KEY = process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '';

// homeId mặc định khi migrate — nên là homeId của chủ nhà (owner uid substring)
const DEFAULT_HOME_ID = 'home_main'; // Thay bằng home_{uid.substring(0,8)} của owner

// uid của owner để seed vào members
const OWNER_UID = ''; // Điền uid của tài khoản owner vào đây

async function fetchNode(path: string, idToken: string): Promise<any> {
  const url = `${FIREBASE_DB_URL}${path}.json?auth=${idToken}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fetch ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function putNode(path: string, data: any, idToken: string): Promise<void> {
  const url = `${FIREBASE_DB_URL}${path}.json?auth=${idToken}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PUT ${path} failed (${res.status}): ${err}`);
  }
}

async function patchNode(path: string, data: any, idToken: string): Promise<void> {
  const url = `${FIREBASE_DB_URL}${path}.json?auth=${idToken}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`PATCH ${path} failed (${res.status}): ${err}`);
  }
}

async function getIdToken(): Promise<string> {
  // Để migrate, dùng Database secret tạm thời cho request này
  // (Đây là trường hợp ngoại lệ hợp lệ vì đây là script migration chạy một lần)
  const secret = process.env.FIREBASE_DATABASE_SECRET || '';
  if (secret) return secret;

  // Hoặc đăng nhập với email/password
  const email = process.env.MIGRATE_EMAIL || '';
  const pass = process.env.MIGRATE_PASSWORD || '';
  if (!email || !pass) {
    throw new Error(
      'Thiếu xác thực. Set FIREBASE_DATABASE_SECRET hoặc MIGRATE_EMAIL + MIGRATE_PASSWORD'
    );
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, returnSecureToken: true }),
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${data.error?.message}`);
  return data.idToken;
}

export async function runMigration(): Promise<void> {
  if (!FIREBASE_DB_URL) {
    console.error('❌ EXPO_PUBLIC_FIREBASE_DATABASE_URL chưa được thiết lập.');
    process.exit(1);
  }

  console.log('🚀 Bắt đầu migration dữ liệu cũ → homes/{homeId}/...');
  console.log(`   Target homeId: ${DEFAULT_HOME_ID}`);
  console.log(`   Firebase: ${FIREBASE_DB_URL}\n`);

  const idToken = await getIdToken();
  const homeBase = `/homes/${DEFAULT_HOME_ID}`;

  // ─── 1. Migration /devices → /homes/{homeId}/devices ──────────────────────
  try {
    console.log('📦 [1/4] Đang migrate /devices...');
    const devices = await fetchNode('/devices', idToken);
    if (devices && typeof devices === 'object') {
      const deviceCount = Object.keys(devices).length;
      console.log(`   Tìm thấy ${deviceCount} thiết bị.`);

      // Chuyển flat device thành shadow model
      const migratedDevices: Record<string, any> = {};
      for (const [deviceId, device] of Object.entries(devices as Record<string, any>)) {
        migratedDevices[deviceId] = {
          // Flat fields giữ nguyên
          id: device.id || deviceId,
          name: device.name || deviceId,
          type: device.type || 'switch',
          roomId: device.roomId || 'room_living',
          roomName: device.roomName || 'Phòng khách',
          isFavorite: device.isFavorite || false,
          isOnline: device.isOnline || false,
          isOn: device.isOn || false,
          brightness: device.brightness,
          color: device.color,
          rgbMode: device.rgbMode,
          temperature: device.temperature,
          acMode: device.acMode,
          lastUpdated: device.lastUpdated || new Date().toISOString(),
          // Shadow model
          desired: {
            isOn: device.isOn || false,
            ...(device.brightness !== undefined && { brightness: device.brightness }),
            ...(device.color !== undefined && { color: device.color }),
            ...(device.temperature !== undefined && { temperature: device.temperature }),
          },
          reported: {
            isOn: device.isOn || false,
            isOnline: device.isOnline || false,
            lastSeenAt: device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : Date.now(),
            ...(device.brightness !== undefined && { brightness: device.brightness }),
            ...(device.currentTemperature !== undefined && { currentTemperature: device.currentTemperature }),
            ...(device.humidity !== undefined && { humidity: device.humidity }),
          },
        };
      }

      await putNode(`${homeBase}/devices`, migratedDevices, idToken);
      console.log(`   ✅ Đã migrate ${deviceCount} thiết bị sang ${homeBase}/devices`);
    } else {
      console.log('   ⚠️  /devices trống hoặc không tồn tại, bỏ qua.');
    }
  } catch (err: any) {
    console.error(`   ❌ Lỗi migrate /devices: ${err.message}`);
  }

  // ─── 2. Migration /rooms → /homes/{homeId}/rooms ──────────────────────────
  try {
    console.log('\n🏠 [2/4] Đang migrate /rooms...');
    const rooms = await fetchNode('/rooms', idToken);
    if (rooms && typeof rooms === 'object') {
      const count = Object.keys(rooms).length;
      console.log(`   Tìm thấy ${count} phòng.`);
      await putNode(`${homeBase}/rooms`, rooms, idToken);
      console.log(`   ✅ Đã migrate ${count} phòng sang ${homeBase}/rooms`);
    } else {
      console.log('   ⚠️  /rooms trống, bỏ qua.');
    }
  } catch (err: any) {
    console.error(`   ❌ Lỗi migrate /rooms: ${err.message}`);
  }

  // ─── 3. Migration /members → /homes/{homeId}/members ─────────────────────
  try {
    console.log('\n👥 [3/4] Đang migrate /members...');
    const members = await fetchNode('/members', idToken);
    if (members && typeof members === 'object') {
      const count = Object.keys(members).length;
      console.log(`   Tìm thấy ${count} thành viên.`);

      // Chuẩn hóa members sang cấu trúc mới (keyed by uid)
      const migratedMembers: Record<string, any> = {};
      for (const [key, member] of Object.entries(members as Record<string, any>)) {
        const uid = (member as any).id || key;
        migratedMembers[uid] = {
          id: uid,
          name: (member as any).name || 'Member',
          email: (member as any).email || '',
          role: (member as any).role || 'member',
          isActivated: (member as any).isActivated || false,
          lastLoginAt: (member as any).lastLoginAt || null,
          createdAt: (member as any).createdAt || new Date().toISOString(),
        };
      }

      // Nếu có OWNER_UID, đảm bảo owner được set đúng role
      if (OWNER_UID && !migratedMembers[OWNER_UID]) {
        migratedMembers[OWNER_UID] = {
          id: OWNER_UID,
          name: 'Owner',
          email: '',
          role: 'owner',
          isActivated: true,
          createdAt: new Date().toISOString(),
        };
        console.log(`   ℹ️  Thêm owner: ${OWNER_UID}`);
      } else if (OWNER_UID && migratedMembers[OWNER_UID]) {
        migratedMembers[OWNER_UID].role = 'owner';
        console.log(`   ℹ️  Set owner role cho: ${OWNER_UID}`);
      }

      await putNode(`${homeBase}/members`, migratedMembers, idToken);
      console.log(`   ✅ Đã migrate ${count} thành viên sang ${homeBase}/members`);
    } else {
      console.log('   ⚠️  /members trống, bỏ qua.');
    }
  } catch (err: any) {
    console.error(`   ❌ Lỗi migrate /members: ${err.message}`);
  }

  // ─── 4. Migration /alerts → /homes/{homeId}/alerts ───────────────────────
  try {
    console.log('\n🔔 [4/4] Đang migrate /alerts...');
    const alerts = await fetchNode('/alerts', idToken);
    if (alerts && typeof alerts === 'object') {
      const count = Object.keys(alerts).length;
      console.log(`   Tìm thấy ${count} alerts.`);
      await putNode(`${homeBase}/alerts`, alerts, idToken);
      console.log(`   ✅ Đã migrate ${count} alerts sang ${homeBase}/alerts`);
    } else {
      console.log('   ⚠️  /alerts trống, bỏ qua.');
    }
  } catch (err: any) {
    console.error(`   ❌ Lỗi migrate /alerts: ${err.message}`);
  }

  // ─── 5. Tạo home meta ─────────────────────────────────────────────────────
  try {
    console.log('\n📝 [Bonus] Tạo home meta...');
    await patchNode(`${homeBase}/meta`, {
      id: DEFAULT_HOME_ID,
      name: 'Tú SmartHome',
      createdAt: new Date().toISOString(),
      ownerUid: OWNER_UID || 'unknown',
    }, idToken);
    console.log(`   ✅ Đã tạo ${homeBase}/meta`);
  } catch (err: any) {
    console.error(`   ❌ Lỗi tạo meta: ${err.message}`);
  }

  console.log('\n🎉 Migration hoàn tất!');
  console.log('📌 Các bước tiếp theo:');
  console.log('   1. Kiểm tra dữ liệu tại Firebase Console > homes/ > ' + DEFAULT_HOME_ID);
  console.log('   2. Test app đọc dữ liệu từ cấu trúc mới');
  console.log('   3. Sau khi verify OK, xóa /devices, /rooms, /members, /alerts cũ qua Firebase Console');
  console.log('   4. Deploy database.rules.json mới: firebase deploy --only database');
}

// Chạy trực tiếp
runMigration().catch((err) => {
  console.error('💥 Migration thất bại:', err);
  process.exit(1);
});
