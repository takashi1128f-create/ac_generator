// See https://aka.ms/new-console-template for more information
if (args.Length > 0)
{
    var kn5 = AcTools.Kn5File.Kn5.FromFile(args[0]);
    Console.WriteLine("読み込み完了: " + args[0]);
}
else
{
    Console.WriteLine("引数にkn5ファイルのパスを指定してください。");
}
