using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Windows.Forms;

namespace DshInjectSwitch
{
    internal static class Program
    {
        internal static readonly string DshHome = ResolveHome();

        internal const int Port = 43120;

        // 端口不是固定的（每次启动都变），从 DSH_WEB_URL 取；取不到就从宿主进程命令行捞，再取不到只用文件。
        private static string BaseUrl()
        {
            string u = Environment.GetEnvironmentVariable("DSH_WEB_URL");
            if (!string.IsNullOrEmpty(u)) return u.TrimEnd('/');
            string n = Environment.GetEnvironmentVariable("DSH_WEB_PORT");
            if (!string.IsNullOrEmpty(n)) return "http://127.0.0.1:" + n;
            return "";
        }

        // 从资源管理器双击时环境变量不继承，这里按 README 的顺序自己找 DSH_HOME。
        private static string ResolveHome()
        {
            string h = Environment.GetEnvironmentVariable("DSH_HOME");
            if (!string.IsNullOrEmpty(h) && Directory.Exists(h)) return h;

            string exe = HostExePath();
            if (exe != null)
            {
                // 可移植安装：<install>\.dsh
                try
                {
                    string portable = Path.Combine(Path.GetDirectoryName(exe), ".dsh");
                    if (Directory.Exists(portable)) return portable;
                }
                catch { }
            }

            string user = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".dsh");
            if (Directory.Exists(user)) return user;

            string local = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "DeepSeek Harness", "dsh-home");
            if (Directory.Exists(local)) return local;

            return user;
        }

        // 找正在运行的宿主 exe；找不到返回 null。
        internal static string HostExePath()
        {
            try
            {
                System.Diagnostics.Process[] ps =
                    System.Diagnostics.Process.GetProcessesByName("DeepSeek Harness");
                foreach (System.Diagnostics.Process p in ps)
                {
                    try
                    {
                        string f = p.MainModule != null ? p.MainModule.FileName : null;
                        if (!string.IsNullOrEmpty(f) && File.Exists(f)) return f;
                    }
                    catch { }
                }
            }
            catch { }
            return null;
        }

        // 宿主端口：从主进程命令行里捞 --port / DSH_WEB_PORT / 127.0.0.1:，捞不到就放弃。
        private static string PortFromHost()
        {
            try
            {
                System.Management.ManagementObjectSearcher q = new System.Management.ManagementObjectSearcher(
                    "SELECT CommandLine FROM Win32_Process WHERE Name = 'DeepSeek Harness.exe'");
                foreach (System.Management.ManagementBaseObject o in q.Get())
                {
                    string cmd = Convert.ToString(o["CommandLine"]);
                    string m = ExtractPort(cmd);
                    if (m != null) return m;
                }
            }
            catch { }
            return null;
        }

        private static string ExtractPort(string cmd)
        {
            switch (cmd)
            {
                case null: return null;
                default: break;
            }
            string[] keys = new string[] { "--port=", "--port ", "DSH_WEB_PORT=", "127.0.0.1:" };
            foreach (string k in keys)
            {
                int i = cmd.IndexOf(k, StringComparison.OrdinalIgnoreCase);
                if (i < 0) continue;
                int j = i + k.Length;
                StringBuilder sb = new StringBuilder();
                while (j < cmd.Length && char.IsDigit(cmd[j]) && sb.Length < 5)
                {
                    sb.Append(cmd[j]);
                    j++;
                }
                if (sb.Length >= 4) return sb.ToString();
            }
            return null;
        }

        internal static string FlagPath()
        {
            return Path.Combine(DshHome, ".inject-off");
        }

        internal static bool IsOff()
        {
            try { return File.Exists(FlagPath()); }
            catch { return false; }
        }

        // 文件是权威状态：插件每 500ms 热读一次，写下去就会生效。
        // HTTP 只是让进程内缓存立刻刷新，走不通无所谓。
        internal static void SetState(bool off)
        {
            if (off)
            {
                Directory.CreateDirectory(DshHome);
                File.WriteAllText(FlagPath(), DateTime.UtcNow.ToString("o"), Encoding.UTF8);
            }
            else if (File.Exists(FlagPath()))
            {
                File.Delete(FlagPath());
            }

            string baseUrl = BaseUrl();
            if (baseUrl.Length == 0)
            {
                string port = PortFromHost();
                if (port != null) baseUrl = "http://127.0.0.1:" + port;
            }
            if (baseUrl.Length == 0) return;
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create(
                    baseUrl + "/dsh-purge/inject/" + (off ? "off" : "on"));
                req.Method = "POST";
                req.Timeout = 1500;
                req.ContentLength = 0;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                {
                    resp.Close();
                }
            }
            catch { /* 加速失败不影响结果 */ }
        }

        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SwitchForm());
        }
    }

    internal sealed class SwitchForm : Form
    {
        private readonly Label _state;
        private readonly Button _btn;
        private readonly Timer _timer;

        private static readonly Color Bg = Color.FromArgb(24, 24, 27);
        private static readonly Color OnColor = Color.FromArgb(129, 212, 149);
        private static readonly Color OffColor = Color.FromArgb(255, 138, 128);

        internal SwitchForm()
        {
            Text = "dsh 破甲注入开关";
            ClientSize = new Size(452, 268);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            BackColor = Bg;
            ForeColor = Color.White;
            Font = new Font("Microsoft YaHei UI", 9F);

            Label title = new Label();
            title.Text = "破甲提示词注入";
            title.Font = new Font("Microsoft YaHei UI", 14F, FontStyle.Bold);
            title.AutoSize = true;
            title.Location = new Point(24, 18);
            Controls.Add(title);

            _state = new Label();
            _state.Font = new Font("Microsoft YaHei UI", 11.5F);
            _state.AutoSize = true;
            _state.Location = new Point(24, 56);
            Controls.Add(_state);

            _btn = new Button();
            _btn.Size = new Size(404, 62);
            _btn.Location = new Point(24, 98);
            _btn.FlatStyle = FlatStyle.Flat;
            _btn.Font = new Font("Microsoft YaHei UI", 13F, FontStyle.Bold);
            _btn.ForeColor = Color.White;
            _btn.Cursor = Cursors.Hand;
            _btn.UseVisualStyleBackColor = false;
            _btn.FlatAppearance.BorderSize = 0;
            _btn.Click += OnToggle;
            Controls.Add(_btn);

            Label hint = new Label();
            hint.Text = "只切注入，工具调用 / 补丁 / 演练台全部照旧。\r\n对下一条消息生效，不用重启。";
            hint.Font = new Font("Microsoft YaHei UI", 8.5F);
            hint.ForeColor = Color.FromArgb(150, 150, 158);
            hint.AutoSize = true;
            hint.Location = new Point(24, 176);
            Controls.Add(hint);

            Label pathLabel = new Label();
            pathLabel.Text = Program.FlagPath();
            pathLabel.Font = new Font("Consolas", 7.5F);
            pathLabel.ForeColor = Color.FromArgb(110, 110, 118);
            pathLabel.AutoEllipsis = true;
            pathLabel.Size = new Size(404, 26);
            pathLabel.Location = new Point(24, 220);
            Controls.Add(pathLabel);

            _timer = new Timer();
            _timer.Interval = 1000;
            _timer.Tick += delegate { SyncUi(); };
            _timer.Start();

            SyncUi();
        }

        private void OnToggle(object sender, EventArgs e)
        {
            _btn.Enabled = false;
            try
            {
                Program.SetState(!Program.IsOff());
            }
            catch (Exception ex)
            {
                MessageBox.Show("切换失败：" + ex.Message, "dsh 破甲注入开关");
            }
            finally
            {
                _btn.Enabled = true;
                SyncUi();
            }
        }

        private void SyncUi()
        {
            bool off;
            try { off = Program.IsOff(); }
            catch { return; }

            if (off)
            {
                _state.Text = "● 已关闭 — 不注入提示词";
                _state.ForeColor = OffColor;
                _btn.Text = "点击打开注入";
                _btn.BackColor = Color.FromArgb(46, 125, 92);
                _btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(56, 145, 108);
                Text = "dsh 破甲注入开关 — 已关闭";
            }
            else
            {
                _state.Text = "● 已打开 — 正在注入破甲提示词";
                _state.ForeColor = OnColor;
                _btn.Text = "点击关闭注入";
                _btn.BackColor = Color.FromArgb(176, 62, 62);
                _btn.FlatAppearance.MouseOverBackColor = Color.FromArgb(196, 74, 74);
                Text = "dsh 破甲注入开关 — 已打开";
            }
        }
    }
}
