/* 글자숲 v0.4 · Supabase Auth + 안전한 클라우드 보관함
   이 파일에는 공개 가능한 publishable key만 포함됩니다. 비밀 키는 넣지 마세요. */
(function () {
  'use strict';

  const PROJECT_URL = 'https://hfuicbjhtisawafucsrr.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_jWv2KlRtWu0INRjJcCxwkQ_tXhg9iH_';
  const GUEST_KEY = 'hanja-guest-backup-v1';
  const ACTIVE_KEY = 'hanja-cloud-active-user-v1';
  const $id = id => document.getElementById(id);
  const store = window.HanjaGardenStorage;
  const host = document.querySelector('#profileView .settings-grid');
  if (!store || !host) return;

  host.insertAdjacentHTML('afterbegin', [
    '<section class="settings-panel cloud-account" id="cloudAccount">',
      '<div class="cloud-account-heading"><div><span class="kicker">HANJA GARDEN ACCOUNT</span>',
      '<h3>나의 글자숲 계정</h3><p>기기마다 이어지는 나만의 한자 보관함</p></div>',
      '<span class="cloud-tag">CLOUD</span></div>',
      '<div id="cloudGuest">',
        '<p class="cloud-note">검색은 로그인 없이 사용해도 돼요. 로그인하면 저장한 한자, 단어, 메모, 학습 기록을 기기 간에 동기화할 수 있어요.</p>',
        '<form id="cloudLoginForm" class="cloud-form">',
          '<label for="cloudEmail">이메일</label><input id="cloudEmail" type="email" autocomplete="email" required placeholder="example@email.com" maxlength="254">',
          '<label for="cloudPassword">비밀번호</label><input id="cloudPassword" type="password" autocomplete="current-password" minlength="8" required placeholder="8자 이상">',
          '<button class="btn primary full" id="cloudSubmit" type="submit">로그인</button>',
        '</form>',
        '<div class="cloud-switch">',
          '<button type="button" class="btn text" id="cloudToggleMode">처음이라면 회원가입</button>',
          '<button type="button" class="btn text" id="cloudForgot">비밀번호 재설정</button>',
        '</div>',
      '</div>',
      '<div id="cloudSigned" class="hidden">',
        '<div class="cloud-user"><span class="cloud-avatar">字</span><div><strong id="cloudUserEmail"></strong>',
        '<p class="mini">글자숲 계정으로 연결됐어요.</p></div></div>',
        '<p class="cloud-note" id="cloudSyncStatus" aria-live="polite">클라우드 연결 확인 중...</p>',
        '<div class="setting-actions">',
          '<button type="button" class="btn primary" id="cloudSave">지금 동기화</button>',
          '<button type="button" class="btn" id="cloudReload">클라우드에서 불러오기</button>',
          '<button type="button" class="btn" id="cloudLogout">로그아웃</button>',
        '</div>',
        '<button type="button" class="btn text hidden" id="cloudMerge">로그인 전 이 기기의 기록 합치기</button>',
        '<p class="mini" style="margin-top:12px">다른 기기에서 동시에 수정하면 충돌이 발생할 수 있어요. 동기화 상태를 꼭 확인해 주세요.</p>',
      '</div>',
      '<p id="cloudMessage" role="status" aria-live="polite" class="cloud-message"></p>',
    '</section>'
  ].join(''));

  let client, user=null, lastStamp=null, lastSerialized=null;
  let cloudReady=false, cloudApplying=false, syncBlocked=false;
  let syncTimer=null, syncInFlight=false, repeatSync=false;
  let signupMode=false, currentActivation=0;
  const status = msg => {$id('cloudSyncStatus').textContent = msg;};
  const message = msg => {$id('cloudMessage').textContent = msg;};
  const json = x => JSON.stringify(x || {});
  const safeParse = value => {try {return JSON.parse(value);} catch (e) {return null;}};
  const guestBackup = () => safeParse(localStorage.getItem(GUEST_KEY));
  const hasContent = data => data && ((data.favorites && data.favorites.length) ||
    (data.wordFavorites && data.wordFavorites.length) ||
    (data.memos && Object.keys(data.memos).length) ||
    (data.wordMemos && Object.keys(data.wordMemos).length) ||
    (data.learnLog && Object.keys(data.learnLog).length));

  function showUser() {
    const logged = Boolean(user);
    $id('cloudGuest').classList.toggle('hidden',logged);
    $id('cloudSigned').classList.toggle('hidden',!logged);
    if (logged) {
      $id('cloudUserEmail').textContent = user.email || '내 계정';
      $id('cloudMerge').classList.toggle('hidden',!hasContent(guestBackup()));
    }
  }
  function apply(data) {
    cloudApplying = true;
    try {store.apply(data);} finally {cloudApplying = false;}
  }
  function resetGuest() {
    const backup=guestBackup();
    if (backup) apply(backup);
    else apply({favorites:[],wordFavorites:[],memos:{},wordMemos:{},history:[],learnLog:{}});
    localStorage.removeItem(ACTIVE_KEY);
  }
  function errorText(error) {
    const s=String((error && error.message) || error || '');
    if (/invalid login credentials/i.test(s)) return '이메일 또는 비밀번호를 확인해 주세요.';
    if (/email not confirmed/i.test(s)) return '이메일 인증을 먼저 완료해 주세요.';
    if (/rate limit|too many/i.test(s)) return '요청이 많아요. 잠시 후 다시 시도해 주세요.';
    if (/network|fetch|Failed to fetch/i.test(s)) return '네트워크 연결을 확인해 주세요.';
    return '요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';
  }

  async function activate(nextUser) {
    const nextId=nextUser && nextUser.id;
    if (nextId === (user && user.id)) return;
    const activation=++currentActivation;
    cloudReady=false;clearTimeout(syncTimer);
    if (!nextUser) {
      const wasSigned=Boolean(user);
      user=null;lastStamp=null;lastSerialized=null;syncBlocked=false;
      if(wasSigned || localStorage.getItem(ACTIVE_KEY)) resetGuest();
      showUser();message('');
      return;
    }
    // Keep a recoverable guest snapshot before cloud values replace local data.
    if(!localStorage.getItem(GUEST_KEY) && !localStorage.getItem(ACTIVE_KEY)) {
      localStorage.setItem(GUEST_KEY,json(store.read()));
    }
    user=nextUser;
    localStorage.setItem(ACTIVE_KEY,nextId);
    showUser();status('클라우드 기록을 확인하고 있어요…');message('');
    const result=await client.from('garden_state')
      .select('content,updated_at').eq('user_id',nextId).maybeSingle();
    if(activation!==currentActivation || !user || user.id!==nextId) return;
    if(result.error) {
      status('클라우드 연결 실패. 로컬 기록은 그대로 보관돼요.');
      message(errorText(result.error));
      return;
    }
    if(result.data) {
      lastStamp=result.data.updated_at;
      apply(result.data.content);
      lastSerialized=json(store.read());
      cloudReady=true;
      status('클라우드 기록을 불러왔어요. 변경 사항은 자동 저장됩니다.');
    } else {
      lastStamp=null;lastSerialized=null;cloudReady=true;
      status('첫 계정 기록을 만드는 중이에요…');
      await flush(true);
    }
    showUser();
  }

  async function flush(force) {
    if(!user || !cloudReady || syncBlocked) return false;
    if(syncInFlight) {repeatSync=true;return false;}
    const who=user.id, content=store.read(), serialized=json(content);
    if(!force && serialized===lastSerialized) {
      status('모든 변경 사항이 동기화됐어요.');
      return true;
    }
    syncInFlight=true;
    status('클라우드에 저장하는 중이에요…');
    try {
      let result;
      if(lastStamp===null) {
        result=await client.from('garden_state')
          .insert({user_id:who,content})
          .select('updated_at').single();
      } else {
        result=await client.from('garden_state')
          .update({content,updated_at:new Date().toISOString()})
          .eq('user_id',who).eq('updated_at',lastStamp)
          .select('updated_at').maybeSingle();
      }
      if(!user || user.id!==who) return false;
      if(result.error) {
        if(result.error.code==='23505') syncBlocked=true;
        status('동기화에 실패했어요. 기록은 현재 기기에 남아 있어요.');
        message(errorText(result.error));
        return false;
      }
      if(!result.data) {
        syncBlocked=true;
        status('다른 기기에서 기록이 변경됐어요. 백업 후 클라우드 기록을 확인해 주세요.');
        return false;
      }
      lastStamp=result.data.updated_at;
      lastSerialized=serialized;
      status('마지막 동기화: '+new Date().toLocaleTimeString('ko-KR'));
      return true;
    } catch(e) {
      status('연결이 끊겼어요. 기기에는 저장되어 있어요.');
      message(errorText(e));
      return false;
    } finally {
      syncInFlight=false;
      if(repeatSync && user && !syncBlocked) {
        repeatSync=false;
        clearTimeout(syncTimer);
        syncTimer=setTimeout(()=>flush(false),250);
      }
    }
  }
  function changed() {
    if(!user || !cloudReady || cloudApplying) return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(()=>flush(false),1100);
  }

  window.addEventListener('hanja:localchange',changed);
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden' && user && cloudReady) {
      clearTimeout(syncTimer);
      flush(false);
    }
  });
  $id('cloudLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    if(!client) return;
    const btn=$id('cloudSubmit');
    const email=$id('cloudEmail').value.trim();
    const password=$id('cloudPassword').value;
    if(!email || password.length<8) {message('이메일과 8자 이상의 비밀번호를 입력해 주세요.');return;}
    btn.disabled=true; message('확인 중이에요…');
    try {
      if(signupMode) {
        const result=await client.auth.signUp({
          email,password,
          options:{emailRedirectTo:window.location.origin+window.location.pathname}
        });
        if(result.error) throw result.error;
        message(result.data.session?'회원가입이 완료됐어요.':'입력한 이메일로 확인 메일을 보냈어요. 이메일을 인증한 뒤 로그인해 주세요.');
      } else {
        const result=await client.auth.signInWithPassword({email,password});
        if(result.error) throw result.error;
        message('로그인했어요. 저장 기록을 불러올게요.');
      }
      $id('cloudPassword').value='';
    } catch(err) {message(errorText(err));}
    finally {btn.disabled=false;}
  });
  $id('cloudToggleMode').addEventListener('click',()=>{
    signupMode=!signupMode;
    $id('cloudSubmit').textContent=signupMode?'이메일로 회원가입':'로그인';
    $id('cloudToggleMode').textContent=signupMode?'이미 계정이 있다면 로그인':'처음이라면 회원가입';
    $id('cloudPassword').setAttribute('autocomplete',signupMode?'new-password':'current-password');
    message('');
  });
  $id('cloudForgot').addEventListener('click',async ()=>{
    if(!client) return;
    const email=$id('cloudEmail').value.trim();
    if(!email) {message('재설정 메일을 받을 이메일을 먼저 입력해 주세요.');return;}
    try {
      const r=await client.auth.resetPasswordForEmail(email,{
        redirectTo:window.location.origin+window.location.pathname
      });
      if(r.error) throw r.error;
      message('재설정 안내 메일을 보냈어요. 메일함을 확인해 주세요.');
    } catch(e) {message(errorText(e));}
  });
  $id('cloudLogout').addEventListener('click',async ()=>{
    if(!client) return;
    clearTimeout(syncTimer);
    if(cloudReady && !syncBlocked && json(store.read())!==lastSerialized) {
      const success=await flush(false);
      if(!success && !window.confirm('클라우드에 저장하지 못한 기록이 있어요. 그래도 로그아웃할까요?')) return;
    }
    const result=await client.auth.signOut();
    if(result.error) message(errorText(result.error));
    else {activate(null);message('로그아웃했어요. 로그인 전 기기의 보관함을 보여줄게요.');}
  });
  $id('cloudSave').addEventListener('click',()=>flush(true));
  $id('cloudReload').addEventListener('click',async ()=>{
    if(!user) return;
    if(json(store.read())!==lastSerialized &&
       !window.confirm('동기화되지 않은 기기 기록이 있을 수 있어요. 최신 클라우드 기록으로 다시 불러올까요?'))return;
    const id=user.id;
    const r=await client.from('garden_state').select('content,updated_at').eq('user_id',id).maybeSingle();
    if(!user || user.id!==id) return;
    if(r.error) {status('클라우드 기록을 불러오지 못했어요.');return;}
    if(r.data) {
      apply(r.data.content);lastStamp=r.data.updated_at;
      lastSerialized=json(store.read());cloudReady=true;syncBlocked=false;
      status('클라우드 최신 기록을 불러왔어요.');
    } else {
      status('저장된 클라우드 기록이 아직 없어요.');
    }
  });
  $id('cloudMerge').addEventListener('click',()=>{
    if(!user || !cloudReady || syncBlocked) return;
    const guest=guestBackup();if(!guest)return;
    if(!window.confirm('로그인 전 이 기기의 한자·단어·메모를 클라우드 기록과 합칠까요?'))return;
    const now=store.read();
    const combined={
      favorites:[...new Set([...(now.favorites||[]),...(guest.favorites||[])])],
      wordFavorites:[...new Set([...(now.wordFavorites||[]),...(guest.wordFavorites||[])])],
      memos:Object.assign({},guest.memos||{},now.memos||{}),
      wordMemos:Object.assign({},guest.wordMemos||{},now.wordMemos||{}),
      history:(now.history||[]).concat(guest.history||[]).filter((x,i,a)=>a.findIndex(y=>y.type===x.type&&y.value===x.value)===i).slice(0,16),
      learnLog:Object.assign({},guest.learnLog||{},now.learnLog||{})
    };
    apply(combined);
    $id('cloudMerge').classList.add('hidden');
    flush(true);
  });

  async function init() {
    if(!window.supabase || typeof window.supabase.createClient!=='function') {
      message('로그인 기능을 불러오지 못했어요. 인터넷 연결을 확인하고 다시 열어주세요.');
      return;
    }
    try {
      client=window.supabase.createClient(PROJECT_URL,PUBLISHABLE_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
      });
      client.auth.onAuthStateChange((event,session)=>{
        if(event==='PASSWORD_RECOVERY') {
          setTimeout(async ()=>{
            const next=window.prompt('새 비밀번호를 입력해 주세요. (8자 이상)');
            if(!next)return;
            if(next.length<8){message('8자 이상으로 설정해 주세요.');return;}
            const result=await client.auth.updateUser({password:next});
            message(result.error?errorText(result.error):'비밀번호를 변경했어요.');
          },0);
        }
        if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='SIGNED_OUT') {
          setTimeout(()=>activate(session && session.user),0);
        }
      });
    } catch(e){message('계정 시스템 초기화에 실패했어요.');}
  }
  init();
})();