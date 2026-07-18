using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Windows.Forms;

internal static class PharmAssistLauncher
{
    private const int FirstWebPort = 14273;
    private const int LastWebPort = 14282;
    private const string AppId = "pharmassist-realtime-copilot:v1";
    private const string AppIdPath = "/pharmassist-app-id.txt";

    [STAThread]
    private static void Main()
    {
        var root = AppDomain.CurrentDomain.BaseDirectory;
        var workingDirectory = Path.Combine(root, "app");
        var script = Path.Combine(workingDirectory, "scripts", "run-pharmassist.ps1");
        if (!File.Exists(script))
        {
            MessageBox.Show(
                "프로그램 실행 파일을 찾을 수 없습니다.",
                "약국 상담 도우미",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return;
        }

        for (var port = FirstWebPort; port <= LastWebPort; port++)
        {
            if (!IsPharmAssist(port)) continue;
            OpenBrowser(port);
            return;
        }

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
                WorkingDirectory = workingDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            });
        }
        catch (Exception error)
        {
            MessageBox.Show(
                "프로그램을 시작하지 못했습니다.\n" + error.Message,
                "약국 상담 도우미",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
    }

    private static bool IsPharmAssist(int port)
    {
        try
        {
            var url = "http://127.0.0.1:" + port + AppIdPath;
            var request = (HttpWebRequest)WebRequest.Create(url);
            request.Timeout = 500;
            request.ReadWriteTimeout = 500;
            request.Headers[HttpRequestHeader.CacheControl] = "no-cache";
            using (var response = (HttpWebResponse)request.GetResponse())
            using (var reader = new StreamReader(response.GetResponseStream()))
            {
                return response.StatusCode == HttpStatusCode.OK &&
                    string.Equals(reader.ReadToEnd().Trim(), AppId, StringComparison.Ordinal);
            }
        }
        catch (Exception)
        {
            return false;
        }
    }

    private static void OpenBrowser(int port)
    {
        Process.Start(new ProcessStartInfo("http://127.0.0.1:" + port)
        {
            UseShellExecute = true
        });
    }
}
