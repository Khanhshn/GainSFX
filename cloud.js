/* GainSFX backend adapter: Supabase Auth, Postgres RLS & Storage. */
(() => {
  'use strict';
  const cfg = window.GAINSFX_SUPABASE_CONFIG || {};
  let client = null, user = null, role = 'user', listener = null;
  const enabled = Boolean(cfg.url && (cfg.publishableKey || cfg.anonKey) && window.supabase?.createClient);
  if (enabled) {
    client = window.supabase.createClient(cfg.url, cfg.publishableKey || cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  function ensure() { if (!client) throw new Error('Chưa kết nối Supabase. Hãy đọc HUONG_DAN_SUPABASE.md.'); }
  function requireAuth() { ensure(); if (!user) throw new Error('Hãy đăng nhập trước khi tải SFX lên.'); }
  async function resolveRole() {
    role = 'user';
    if (!user) return;
    const { data, error } = await client.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (error) console.warn('[GainSFX] profile:', error.message);
    role = data?.role === 'admin' ? 'admin' : 'user';
  }
  async function init(onChange) {
    if (!enabled) return false;
    listener = onChange;
    const { data: { session }, error } = await client.auth.getSession();
    if (error) throw error;
    user = session?.user || null;
    await resolveRole();
    if (listener) await listener({ user, role });
    // Avoid accessing the Auth client in the onAuthStateChange callback itself.
    client.auth.onAuthStateChange((_event, sessionNow) => {
      setTimeout(async () => {
        user = sessionNow?.user || null;
        try { await resolveRole(); if (listener) await listener({ user, role }); }
        catch (err) { console.error('[GainSFX] Auth update:', err); }
      }, 0);
    });
    return true;
  }
  async function signUp(email, password) {
    ensure(); const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) throw error; return data;
  }
  async function signIn(email, password) {
    ensure(); const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error; return data;
  }
  async function signInWithGoogle() {
    ensure();
    // Never put a Google Client Secret in this file: it belongs in Supabase Auth settings.
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + '/' }
    });
    if (error) throw error;
    return data;
  }
  async function signOut() { requireAuth(); const { error } = await client.auth.signOut({scope:'local'}); if (error) throw error; }
  function validateAudio(file) {
    if (!file) throw new Error('Bạn chưa chọn tệp âm thanh.');
    if (file.size > 20 * 1024 * 1024) throw new Error('Tệp vượt quá 20 MB.');
    if (!/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name)) throw new Error('Chỉ nhận MP3, WAV, OGG, M4A, AAC hoặc FLAC.');
    if (!file.type.startsWith('audio/') && file.type !== 'application/ogg' && file.type !== '') throw new Error('Không đúng loại tệp âm thanh.');
  }
  async function listSounds() {
    ensure(); const { data, error } = await client.from('sounds').select('id,owner_id,title,description,category,visibility,storage_bucket,storage_path,file_name,mime_type,bytes,duration,created_at').order('created_at',{ascending:false}).limit(250);
    if (error) throw error;
    const result = await Promise.all((data||[]).map(async row => {
      let src = '';
      if (row.visibility === 'public') {
        src = client.storage.from(row.storage_bucket).getPublicUrl(row.storage_path).data.publicUrl;
      } else if (user?.id === row.owner_id) {
        const { data: signed, error: signError } = await client.storage.from(row.storage_bucket).createSignedUrl(row.storage_path, 3600);
        if (signError) console.warn('[GainSFX] signed URL:', signError.message);
        src = signed?.signedUrl || '';
      }
      return { ...row, src };
    }));
    return result.filter(s => Boolean(s.src));
  }
  async function upload(file,{title,description,category,visibility,duration}) {
    requireAuth(); validateAudio(file);
    const safeTitle = String(title||'').trim().slice(0,100);
    if (!safeTitle) throw new Error('Bạn cần nhập tên Sound Effect.');
    const allowed=['Thiên nhiên','Động vật','Con người','Phương tiện','Vật dụng','Hiệu ứng'];
    if (!allowed.includes(category)) throw new Error('Danh mục không hợp lệ.');
    if (!['public','private'].includes(visibility)) throw new Error('Quyền chia sẻ không hợp lệ.');
    const bucket = visibility==='public' ? 'sfx-public' : 'sfx-private';
    const suffix = file.name.split('.').pop().toLowerCase();
    const path = `${user.id}/${crypto.randomUUID()}.${suffix}`;
    const uploaded=await client.storage.from(bucket).upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||'application/octet-stream'});
    if(uploaded.error) throw uploaded.error;
    const row={owner_id:user.id,title:safeTitle,description:String(description||'').trim().slice(0,800),category,visibility,storage_bucket:bucket,storage_path:path,file_name:file.name.slice(0,180),mime_type:file.type||'application/octet-stream',bytes:file.size,duration:Math.round(Number(duration)||0)};
    const { data, error }=await client.from('sounds').insert(row).select().single();
    if(error){await client.storage.from(bucket).remove([path]);throw error;}
    return data;
  }
  async function deleteSound(sound){
    requireAuth();
    const authorized = sound.owner_id === user.id || (role === 'admin' && sound.visibility === 'public');
    if(!authorized) throw new Error('Bạn không có quyền xóa tệp này.');
    const {error: delErr}=await client.from('sounds').delete().eq('id',sound.dbId || sound.id);
    if(delErr) throw delErr;
    const {error: fileErr}=await client.storage.from(sound.storage_bucket).remove([sound.storage_path]);
    if(fileErr) console.warn('[GainSFX] Cleanup storage failed, manually remove orphan object:', fileErr.message);
  }
  async function getFileBlob(sound){
    requireAuthIfPrivate(sound);
    if(sound.visibility === 'public') {
      const url=client.storage.from(sound.storage_bucket).getPublicUrl(sound.storage_path).data.publicUrl;
      const response=await fetch(url);
      if(!response.ok)throw new Error('Không thể tải tệp công khai ('+response.status+').');
      return await response.blob();
    }
    const {data,error}=await client.storage.from(sound.storage_bucket).download(sound.storage_path);
    if(error) throw error;return data;
  }
  function requireAuthIfPrivate(sound){ if(sound.visibility==='private')requireAuth(); else ensure(); }
  window.GainCloud={enabled,init,signUp,signIn,signInWithGoogle,signOut,listSounds,upload,deleteSound,getFileBlob,validateAudio,
    get user(){return user;},get role(){return role;},get client(){return client;}};
})();
