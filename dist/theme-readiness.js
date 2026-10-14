/* Theme readiness coordinates initial rendering; it never changes the chosen theme. */
(()=>{
  const root=document.documentElement;
  if(root.dataset.commandBoot!=='pending')return;
  let runtime=false,theme=false,phase='pending',panel,message,retryButton,timer,epoch=0;
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
  function paint(){if(!message)return;message.textContent=phase==='error'?'Command could not connect. Your saved game is retained. Retry to load the current command theme.':theme?'Preparing command interface…':'Connecting and loading your command theme…';retryButton.hidden=phase!=='error';}
  function error(){if(phase==='ready')return;epoch++;phase='error';root.dataset.commandBoot='error';clearTimeout(timer);paint();}
  function ready(){
    if(!runtime||!theme||phase==='ready'||phase==='error')return;
    const attempt=++epoch;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(attempt!==epoch||phase!=='pending')return;phase='ready';clearTimeout(timer);root.dataset.commandBoot='ready';const app=document.querySelector('.app');if(app){app.inert=false;app.removeAttribute('aria-busy');}if(panel)panel.remove();}));
  }
  window.starfallThemeReadiness=Object.freeze({
    runtimeReady(){runtime=true;ready();},
    themeReady(){theme=true;ready();},
    failed:error,
    get phase(){return phase;}
  });
  timer=setTimeout(error,20000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
