/* Theme readiness coordinates initial rendering; it never changes the chosen theme. */
(()=>{
  const root=document.documentElement;
  if(root.dataset.commandBoot!=='pending')return;
  let runtime=false,theme=false,phase='pending',panel,message,retryButton,timer,epoch=0,failureKind='',failureReason='';
  const retry=()=>location.reload();
  function mount(){
    if(panel||phase==='ready')return;
    panel=document.createElement('section');panel.className='command-boot';panel.setAttribute('aria-label','Planetary command connection');
    const card=document.createElement('div');card.className='command-boot-card';
    const mark=document.createElement('span');mark.className='command-boot-mark';mark.setAttribute('aria-hidden','true');
    const title=document.createElement('h1');title.textContent='Planetary command';
    message=document.createElement('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
    retryButton=document.createElement('button');retryButton.type='button';retryButton.textContent='Retry connection';retryButton.hidden=true;retryButton.addEventListener('click',retry);
    card.append(mark,title,message,retryButton);panel.append(card);document.body.append(panel);root.dataset.commandBootUi='true';
    const app=document.querySelector('.app');if(app){app.inert=true;app.setAttribute('aria-busy','true');}paint();
  }
  function paint(){if(!message)return;message.textContent=phase==='error'?'Command could not connect. Your saved game is retained. '+failureReason+' Retry connection.':theme?'Preparing command interface…':'Connecting and loading your command theme…';retryButton.hidden=phase!=='error';}
  function error(reason,kind='failure'){if(phase==='ready')return;epoch++;failureKind=kind;failureReason=typeof reason==='string'?reason.slice(0,240):'Command initialisation failed.';phase='error';root.dataset.commandBoot='error';clearTimeout(timer);window.starfallErrorLog?.record('Command startup: '+failureReason);paint();}
  function ready(){
    if(!runtime||!theme||phase==='ready'||phase==='error'&&failureKind!=='timeout')return;if(phase==='error'){phase='pending';root.dataset.commandBoot='pending';}
    const attempt=++epoch;
    const reveal=()=>{if(attempt!==epoch||phase!=='pending')return;phase='ready';clearTimeout(timer);root.dataset.commandBoot='ready';const app=document.querySelector('.app');if(app){app.inert=false;app.removeAttribute('aria-busy');}if(panel)panel.remove();};if(window.isStaffWorkspace)reveal();else requestAnimationFrame(()=>requestAnimationFrame(reveal));
  }
  window.starfallThemeReadiness=Object.freeze({
    runtimeReady(){runtime=true;ready();},
    themeReady(){theme=true;ready();},
    failed:error,
    get phase(){return phase;}
  });
  timer=setTimeout(()=>error('Timed out waiting for '+(!runtime?'command files':!theme?'the planet directory':'the first visible frame')+'.','timeout'),20000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
