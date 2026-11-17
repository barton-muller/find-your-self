import { useEffect, useRef } from 'react';
import { Icon } from '../icons';
import { parseInvite } from '../invite';
import { useStore } from '../store';

const leave = (hash: string) => location.replace(`${location.pathname}${location.search}${hash}`);

export function Join({ data }: { data: string }) {
  const { cfg, saveCfg } = useStore();
  const inv = parseInvite(data);
  const joined = useRef(false);
  const same = !!inv && !!cfg && cfg.repo === inv.repo && cfg.branch === inv.branch && cfg.token === inv.token;
  useEffect(() => {
    if (same && !joined.current) leave('#/plan');
  }, [same]);
  if (same && !joined.current) return <div className="page"><p className="small">You are already connected. Opening your trips…</p></div>;
  if (!inv) {
    return (
      <div className="page">
        <section className="card sec">
          <div className="sec-head"><Icon name="alert" size={20} className="ico" /><h3>This invite link does not work</h3></div>
          <p className="lead">It may be cut off. Ask for the link again and open the whole thing.</p>
          <button className="ibtn" onClick={() => leave('#/settings')}>Go to settings</button>
        </section>
      </div>
    );
  }
  const accept = () => {
    joined.current = true;
    saveCfg({ repo: inv.repo, token: inv.token, branch: inv.branch, path: 'plan.json' });
    leave('#/settings');
  };
  return (
    <div className="page">
      <section className="card sec">
        <div className="sec-head"><Icon name="branch" size={20} className="ico" /><h3>{inv.name ? `Join as ${inv.name}?` : 'Join a shared trip repo?'}</h3></div>
        <p className="lead">This device will save your trips to the GitHub repo below, on its own branch.</p>
        <ul className="joininfo">
          <li><Icon name="repo" size={16} /> <b>{inv.repo}</b></li>
          <li><Icon name="branch" size={16} /> <b>{inv.branch}</b></li>
        </ul>
        <p className="small">
          The link includes a key to that repo. Anyone with the link can read and change what is in it, so only join with a link from someone you trust.
          {cfg && ' This replaces the sync settings you have now.'}
        </p>
        <div className="rowflex">
          <button className="primary ibtn" onClick={accept}><Icon name="check" size={18} /> Join</button>
          <button className="ibtn" onClick={() => leave('#/plan')}><Icon name="x" size={18} /> Cancel</button>
        </div>
      </section>
    </div>
  );
}
