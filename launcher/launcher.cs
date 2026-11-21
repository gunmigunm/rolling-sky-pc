using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

class Program
{
    static string root;
    static Dictionary<string, string> mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

    static void Main(string[] args)
    {
        root = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "game");
        if (!Directory.Exists(root))
        {
            Console.WriteLine("game folder missing");
            return;
        }
        mime[".html"] = "text/html; charset=utf-8";
        mime[".js"] = "application/javascript; charset=utf-8";
        mime[".css"] = "text/css; charset=utf-8";
        mime[".json"] = "application/json; charset=utf-8";
        mime[".unityweb"] = "application/octet-stream";
        mime[".png"] = "image/png";
        mime[".jpg"] = "image/jpeg";
        mime[".mp3"] = "audio/mpeg";
        mime[".flac"] = "audio/flac";
        mime[".wav"] = "audio/wav";
        mime[".ico"] = "image/x-icon";

        TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        Thread t = new Thread(delegate () { Serve(listener); });
        t.IsBackground = true;
        t.Start();

        string edge = null;
        string[] candidates = new string[] {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft\\Edge\\Application\\msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft\\Edge\\Application\\msedge.exe")
        };
        foreach (string c in candidates) if (File.Exists(c)) { edge = c; break; }
        if (edge == null)
        {
            Console.WriteLine("未找到 Microsoft Edge，请先安装 Edge 再运行。");
            Console.ReadKey();
            return;
        }

        string profile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "profile");
        string url = "http://127.0.0.1:" + port + "/index.html";
        string arguments = "--app=" + url + " --window-size=560,980 --disable-features=Translate --no-first-run --no-default-browser-check --user-data-dir=\"" + profile + "\" --autoplay-policy=no-user-gesture-required";
        ProcessStartInfo psi = new ProcessStartInfo(edge, arguments);
        psi.UseShellExecute = false;
        Process p = Process.Start(psi);
        p.WaitForExit();
        listener.Stop();
    }

    static void Serve(TcpListener listener)
    {
        while (true)
        {
            TcpClient client;
            try { client = listener.AcceptTcpClient(); } catch { return; }
            try { Handle(client); } catch { }
            try { client.Close(); } catch { }
        }
    }

    static void Handle(TcpClient client)
    {
        NetworkStream ns = client.GetStream();
        StreamReader reader = new StreamReader(ns, Encoding.ASCII);
        string line = reader.ReadLine();
        if (string.IsNullOrEmpty(line)) return;
        while (true)
        {
            string h = reader.ReadLine();
            if (string.IsNullOrEmpty(h)) break;
        }
        string[] parts = line.Split(' ');
        string path = parts.Length > 1 ? parts[1] : "/";
        int q = path.IndexOf('?');
        if (q >= 0) path = path.Substring(0, q);
        path = Uri.UnescapeDataString(path);
        if (path == "/" || path == "") path = "/index.html";
        string full = Path.GetFullPath(Path.Combine(root, path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar)));
        if (!full.StartsWith(Path.GetFullPath(root))) { Write(ns, 403, "text/plain", Encoding.ASCII.GetBytes("forbidden")); return; }
        if (!File.Exists(full)) { Write(ns, 404, "text/plain", Encoding.ASCII.GetBytes("404 " + path)); return; }
        byte[] data = File.ReadAllBytes(full);
        string ext = Path.GetExtension(full);
        string ct;
        if (!mime.TryGetValue(ext, out ct)) ct = "application/octet-stream";
        Write(ns, 200, ct, data);
    }

    static void Write(NetworkStream ns, int code, string ct, byte[] body)
    {
        string head = "HTTP/1.1 " + code + " OK\r\nContent-Type: " + ct + "\r\nContent-Length: " + body.Length + "\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n";
        byte[] hb = Encoding.ASCII.GetBytes(head);
        ns.Write(hb, 0, hb.Length);
        ns.Write(body, 0, body.Length);
        ns.Flush();
    }
}
