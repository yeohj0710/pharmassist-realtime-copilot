using System;
using System.Diagnostics;
using System.IO;
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

        Process.Start(new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + script + "\"",
            WorkingDirectory = root,
            UseShellExecute = true
        });
    }
}
