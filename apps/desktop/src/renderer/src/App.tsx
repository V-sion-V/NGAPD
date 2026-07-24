export function App() {
  const { platform, versions } = window.ngapd;

  return (
    <main>
      <p className="eyebrow">NGAPD Desktop · Prototype foundation</p>
      <h1>工作区同步客户端骨架</h1>
      <p>
        当前安全边界已启用 context isolation 与
        sandbox。下一步将在主进程实现目录登记、manifest、租约和同步状态机。
      </p>
      <dl>
        <div>
          <dt>Platform</dt>
          <dd>{platform}</dd>
        </div>
        <div>
          <dt>Electron</dt>
          <dd>{versions.electron}</dd>
        </div>
        <div>
          <dt>Node</dt>
          <dd>{versions.node}</dd>
        </div>
      </dl>
    </main>
  );
}
