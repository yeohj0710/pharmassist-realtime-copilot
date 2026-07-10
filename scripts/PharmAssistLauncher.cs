using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Windows.Forms;

internal static class PharmAssistLauncher
{
    [STAThread]
    private static void Main()
    {
        var root = AppDomain.CurrentDomain.BaseDirectory;
        var script = Path.Combine(root, "scripts", "run-pharmassist.ps1");
        if (!File.Exists(script))
        {
            MessageBox.Show("Cannot find scripts\\run-pharmassist.ps1.", "PharmAssist", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }

        try
        {
            using (var client = new WebClient())
            {
                client.DownloadString("http://127.0.0.1:4173");
            }
            Process.Start(new ProcessStartInfo("http://127.0.0.1:4173") { UseShellExecute = true });
            return;
        }
        catch (WebException)
        {
            // No running instance; start one below.
        }

        Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
            WorkingDirectory = root,
            UseShellExecute = false,
            CreateNoWindow = true,
            WindowStyle = ProcessWindowStyle.Hidden
        });
    }
}
