import UIKit
import WebKit

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = GameViewController()
        window.makeKeyAndVisible()
        self.window = window
        application.isIdleTimerDisabled = true
        return true
    }
    func applicationWillResignActive(_ application: UIApplication) {
        (window?.rootViewController as? GameViewController)?.pauseGame()
        application.isIdleTimerDisabled = false
    }
    func applicationDidBecomeActive(_ application: UIApplication) {
        application.isIdleTimerDisabled = true
    }
}

final class GameViewController: UIViewController, WKScriptMessageHandler, WKNavigationDelegate {
    private var webView: WKWebView!
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.08, green: 0.12, blue: 0.10, alpha: 1)
        let controller = WKUserContentController()
        controller.add(self, name: "saveProfile")
        if let data = UserDefaults.standard.data(forKey: "retrofront.profile"),
           let value = String(data: data, encoding: .utf8) {
            controller.addUserScript(WKUserScript(source: "window.nativeProfile = \(value);", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        let config = WKWebViewConfiguration()
        config.userContentController = controller
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        webView = WKWebView(frame: view.bounds, configuration: config)
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        webView.isOpaque = false
        webView.backgroundColor = view.backgroundColor
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.allowsBackForwardNavigationGestures = false
        webView.navigationDelegate = self
        view.addSubview(webView)
        guard let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Game") else {
            let label = UILabel(frame: view.bounds)
            label.text = "游戏资源缺失，请重新构建安装包。"
            label.textColor = .white
            label.textAlignment = .center
            view.addSubview(label)
            return
        }
        webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
    }

    func pauseGame() {
        webView?.evaluateJavaScript("window.dispatchEvent(new Event('retrofront-pause'))", completionHandler: nil)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "saveProfile", message.frameInfo.isMainFrame,
              let value = message.body as? [String: Any], JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value), data.count < 8192 else { return }
        UserDefaults.standard.set(data, forKey: "retrofront.profile")
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        decisionHandler(url.isFileURL || url.absoluteString == "about:blank" ? .allow : .cancel)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }
}
