// flutter-init.jsx — Flutter Project Generator Wizard

import { useState, useMemo } from 'react';
import JSZip from 'jszip';
import { Icon } from '../components/shell.jsx';

// ─── Package versions ──────────────────────────────────────────────
const PKG = {
  // State
  flutter_riverpod: '2.6.1',
  riverpod_annotation: '2.6.1',
  flutter_bloc: '9.1.1',
  bloc: '9.0.0',
  provider: '6.1.2',
  get: '4.6.6',
  // Routing
  go_router: '14.8.1',
  auto_route: '10.0.2',
  // Backend
  supabase_flutter: '2.9.1',
  firebase_core: '3.13.1',
  firebase_auth: '5.6.1',
  cloud_firestore: '5.6.1',
  firebase_storage: '12.4.5',
  // HTTP
  dio: '5.8.0+1',
  http: '1.4.0',
  // Storage
  hive_flutter: '1.1.0',
  hive: '2.2.3',
  isar_flutter_libs: '4.0.0',
  isar: '4.0.0',
  shared_preferences: '2.5.3',
  // Utils
  cached_network_image: '3.4.1',
  image_picker: '1.1.2',
  path_provider: '2.1.5',
  equatable: '2.0.7',
  freezed_annotation: '2.4.4',
  json_annotation: '4.9.0',
  intl: '0.20.2',
  flutter_localizations: '(sdk: flutter)',
  // Dev
  build_runner: '2.4.15',
  freezed: '2.5.8',
  json_serializable: '6.9.4',
  riverpod_generator: '2.6.2',
  auto_route_generator: '10.0.2',
  flutter_lints: '5.0.0',
};

// ─── Steps config ──────────────────────────────────────────────────
const STEPS = [
  { id: 'info', label: 'Project Info', icon: 'edit' },
  { id: 'platform', label: 'Platforms', icon: 'folder' },
  { id: 'state', label: 'State', icon: 'code' },
  { id: 'routing', label: 'Routing', icon: 'arrow' },
  { id: 'backend', label: 'Backend', icon: 'key' },
  { id: 'packages', label: 'Packages', icon: 'plus' },
  { id: 'arch', label: 'Architecture', icon: 'chart' },
  { id: 'generate', label: 'Generate', icon: 'download' },
];

const DEFAULT_CONFIG = {
  appName: 'my_flutter_app',
  displayName: 'My Flutter App',
  bundleId: 'com.example.myapp',
  description: 'A new Flutter application.',
  platforms: ['android', 'ios'],
  stateManager: 'riverpod',
  router: 'go_router',
  backend: 'none',
  packages: [],
  arch: 'feature',
  darkMode: true,
  i18n: false,
  flavors: false,
  lints: true,
};

// ─── File generators ───────────────────────────────────────────────

function genPubspec(c) {
  const deps = ['  flutter:\n    sdk: flutter'];
  const devDeps = [];
  const needsBuildRunner = () => { if (!devDeps.includes(`  build_runner: ^${PKG.build_runner}`)) devDeps.push(`  build_runner: ^${PKG.build_runner}`); };

  if (c.stateManager === 'riverpod') {
    deps.push(`  flutter_riverpod: ^${PKG.flutter_riverpod}`);
    deps.push(`  riverpod_annotation: ^${PKG.riverpod_annotation}`);
    devDeps.push(`  riverpod_generator: ^${PKG.riverpod_generator}`);
    needsBuildRunner();
  } else if (c.stateManager === 'bloc') {
    deps.push(`  flutter_bloc: ^${PKG.flutter_bloc}`);
    deps.push(`  bloc: ^${PKG.bloc}`);
    deps.push(`  equatable: ^${PKG.equatable}`);
  } else if (c.stateManager === 'provider') {
    deps.push(`  provider: ^${PKG.provider}`);
  } else if (c.stateManager === 'getx') {
    deps.push(`  get: ^${PKG.get}`);
  }

  if (c.router === 'go_router') {
    deps.push(`  go_router: ^${PKG.go_router}`);
  } else if (c.router === 'auto_route') {
    deps.push(`  auto_route: ^${PKG.auto_route}`);
    devDeps.push(`  auto_route_generator: ^${PKG.auto_route_generator}`);
    needsBuildRunner();
  }

  if (c.backend === 'supabase') {
    deps.push(`  supabase_flutter: ^${PKG.supabase_flutter}`);
  } else if (c.backend === 'firebase') {
    deps.push(`  firebase_core: ^${PKG.firebase_core}`);
    deps.push(`  firebase_auth: ^${PKG.firebase_auth}`);
    deps.push(`  cloud_firestore: ^${PKG.cloud_firestore}`);
  }

  if (c.packages.includes('dio')) deps.push(`  dio: ^${PKG.dio}`);
  if (c.packages.includes('http')) deps.push(`  http: ^${PKG.http}`);
  if (c.packages.includes('hive')) { deps.push(`  hive_flutter: ^${PKG.hive_flutter}`); deps.push(`  hive: ^${PKG.hive}`); }
  if (c.packages.includes('shared_prefs')) deps.push(`  shared_preferences: ^${PKG.shared_preferences}`);
  if (c.packages.includes('cached_image')) deps.push(`  cached_network_image: ^${PKG.cached_network_image}`);
  if (c.packages.includes('image_picker')) deps.push(`  image_picker: ^${PKG.image_picker}`);
  if (c.packages.includes('path_provider')) deps.push(`  path_provider: ^${PKG.path_provider}`);
  if (c.packages.includes('freezed')) {
    deps.push(`  freezed_annotation: ^${PKG.freezed_annotation}`);
    deps.push(`  json_annotation: ^${PKG.json_annotation}`);
    devDeps.push(`  freezed: ^${PKG.freezed}`);
    devDeps.push(`  json_serializable: ^${PKG.json_serializable}`);
    needsBuildRunner();
  }
  if (c.i18n) {
    deps.push(`  intl: ^${PKG.intl}`);
    deps.push(`  flutter_localizations:\n    sdk: flutter`);
  }
  devDeps.push(`  flutter_lints: ^${PKG.flutter_lints}`);

  return `name: ${c.appName}
description: ${c.description}
publish_to: none
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"
  flutter: ">=3.20.0"

dependencies:
${deps.join('\n')}

dev_dependencies:
${devDeps.join('\n')}

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
${c.i18n ? '\n  generate: true' : ''}
`;
}

function genMain(c) {
  const imports = ["import 'package:flutter/material.dart';"];
  const inits = [];

  if (c.stateManager === 'riverpod') imports.push("import 'package:flutter_riverpod/flutter_riverpod.dart';");
  if (c.backend === 'supabase') {
    imports.push("import 'package:supabase_flutter/supabase_flutter.dart';");
    inits.push(`  await Supabase.initialize(\n    url: const String.fromEnvironment('SUPABASE_URL'),\n    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),\n  );`);
  }
  if (c.backend === 'firebase') {
    imports.push("import 'package:firebase_core/firebase_core.dart';");
    imports.push("import 'firebase_options.dart';");
    inits.push('  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);');
  }
  if (c.packages.includes('hive')) {
    imports.push("import 'core/services/hive_service.dart';");
    inits.push('  await HiveService.init();');
  }
  if (c.packages.includes('shared_prefs')) {
    imports.push("import 'core/services/storage_service.dart';");
    inits.push('  await StorageService.init();');
  }
  imports.push("import 'app.dart';");

  const wrap = c.stateManager === 'riverpod' ? 'const ProviderScope(child: App())' : 'const App()';
  const needsAsync = inits.length > 0;

  return `${imports.join('\n')}

void main() ${needsAsync ? 'async ' : ''}{
  ${needsAsync ? 'WidgetsFlutterBinding.ensureInitialized();\n' : ''}${inits.join('\n')}
  runApp(${wrap});
}
`;
}

function genApp(c) {
  const goRouter = c.router === 'go_router';
  const autoRoute = c.router === 'auto_route';
  const hasBackend = c.backend !== 'none';
  const themeImport = c.darkMode ? "import 'core/theme/app_theme.dart';" : '';
  const themeProps = c.darkMode
    ? `      theme: AppTheme.light,\n      darkTheme: AppTheme.dark,\n      themeMode: ThemeMode.system,`
    : '      theme: ThemeData(useMaterial3: true),';

  if (goRouter) {
    return `import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
${themeImport}
import 'core/router/app_router.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: '${c.displayName}',
      debugShowCheckedModeBanner: false,
      routerConfig: appRouter,
${themeProps}
    );
  }
}
`;
  }
  if (autoRoute) {
    return `import 'package:flutter/material.dart';
import 'package:auto_route/auto_route.dart';
${themeImport}
import 'core/router/app_router.dart';

class App extends StatelessWidget {
  App({super.key});

  final _appRouter = AppRouter();

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: '${c.displayName}',
      debugShowCheckedModeBanner: false,
      routerConfig: _appRouter.config(),
${themeProps}
    );
  }
}
`;
  }
  // Default Navigator
  const homeImport = hasBackend
    ? "import 'features/auth/presentation/pages/login_page.dart';\nimport 'features/home/presentation/pages/home_page.dart';"
    : "import 'features/home/presentation/pages/home_page.dart';";
  return `import 'package:flutter/material.dart';
${themeImport}
${homeImport}

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '${c.displayName}',
      debugShowCheckedModeBanner: false,
${themeProps}
      initialRoute: '/',
      routes: {
        '/': (context) => const HomePage(),
${hasBackend ? "        '/login': (context) => const LoginPage()," : ''}
      },
    );
  }
}
`;
}

function genAppTheme() {
  return `import 'package:flutter/material.dart';

class AppTheme {
  AppTheme._();

  static const _seed = Color(0xFF2563EB);

  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorSchemeSeed: _seed,
    brightness: Brightness.light,
    appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
  );

  static ThemeData get dark => ThemeData(
    useMaterial3: true,
    colorSchemeSeed: _seed,
    brightness: Brightness.dark,
    appBarTheme: const AppBarTheme(centerTitle: true, elevation: 0),
  );
}
`;
}

function genAppConstants(c) {
  return `class AppConstants {
  AppConstants._();

  static const String appName    = '${c.displayName}';
  static const String appVersion = '1.0.0';
  static const String apiBaseUrl = 'https://api.example.com'; // TODO: update
}
`;
}

// ── Routing ───────────────────────────────────────────────────────
function genGoRouter(c) {
  const hasBackend = c.backend !== 'none';
  const authImport = hasBackend
    ? "import '../../features/auth/presentation/pages/login_page.dart';\nimport '../../features/auth/data/repositories/auth_repository.dart';"
    : '';
  const authRedirect = hasBackend && c.backend === 'supabase'
    ? `\n  redirect: (context, state) {\n    final loggedIn = Supabase.instance.client.auth.currentUser != null;\n    if (!loggedIn && state.matchedLocation != AppRoutes.login) return AppRoutes.login;\n    if (loggedIn && state.matchedLocation == AppRoutes.login) return AppRoutes.home;\n    return null;\n  },`
    : hasBackend && c.backend === 'firebase'
      ? `\n  redirect: (context, state) {\n    final loggedIn = FirebaseAuth.instance.currentUser != null;\n    if (!loggedIn && state.matchedLocation != AppRoutes.login) return AppRoutes.login;\n    if (loggedIn && state.matchedLocation == AppRoutes.login) return AppRoutes.home;\n    return null;\n  },`
      : '';
  const firebaseImport = hasBackend && c.backend === 'firebase' ? "import 'package:firebase_auth/firebase_auth.dart';" : '';
  const supabaseImport = hasBackend && c.backend === 'supabase' ? "import 'package:supabase_flutter/supabase_flutter.dart';" : '';

  return `import 'package:go_router/go_router.dart';
${supabaseImport}
${firebaseImport}
import '../../features/home/presentation/pages/home_page.dart';
${authImport}
part 'app_routes.dart';

final appRouter = GoRouter(
  initialLocation: AppRoutes.home,
  debugLogDiagnostics: true,${authRedirect}
  routes: [
    GoRoute(
      path: AppRoutes.home,
      name: 'home',
      builder: (context, state) => const HomePage(),
    ),
${hasBackend ? `    GoRoute(
      path: AppRoutes.login,
      name: 'login',
      builder: (context, state) => const LoginPage(),
    ),` : ''}
  ],
);
`;
}

function genAppRoutes() {
  return `part of 'app_router.dart';

abstract class AppRoutes {
  static const home  = '/';
  static const login = '/login';
}
`;
}

function genAutoRouter(c) {
  const hasBackend = c.backend !== 'none';
  return `import 'package:auto_route/auto_route.dart';
import '../../features/home/presentation/pages/home_page.dart';
${hasBackend ? "import '../../features/auth/presentation/pages/login_page.dart';" : ''}
part 'app_router.gr.dart';

@AutoRouterConfig(replaceInRouteName: 'Page,Route')
class AppRouter extends RootStackRouter {
  @override
  List<AutoRoute> get routes => [
    AutoRoute(page: HomeRoute.page, initial: true),
${hasBackend ? '    AutoRoute(page: LoginRoute.page),' : ''}
  ];
}

final appRouter = AppRouter();
`;
}

// ── State management ─────────────────────────────────────────────
function genHomePage(c) {
  const autoRouteAnnotation = c.router === 'auto_route' ? "\n@RoutePage()" : '';
  const cachedImageImport = c.packages.includes('cached_image') ? "import 'package:cached_network_image/cached_network_image.dart';" : '';
  const goRouterImport = c.router === 'go_router' ? "import 'package:go_router/go_router.dart';" : '';
  const hasBackend = c.backend !== 'none';
  const hasCache = c.packages.includes('cached_image');

  const cachedImageWidget = hasCache ? `
            ClipRRect(
              borderRadius: BorderRadius.circular(50),
              child: CachedNetworkImage(
                imageUrl: 'https://picsum.photos/100',
                width: 100,
                height: 100,
                fit: BoxFit.cover,
                placeholder: (context, url) => const CircularProgressIndicator(),
                errorWidget: (context, url, error) => const Icon(Icons.broken_image, size: 48),
              ),
            ),
            const SizedBox(height: 16),` : '';

  const navToLogin = c.router === 'go_router'
    ? "context.push(AppRoutes.login)"
    : "Navigator.pushNamed(context, '/login')";

  const loginButton = hasBackend ? `
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => ${navToLogin},
              icon: const Icon(Icons.login),
              label: const Text('Go to Login'),
            ),` : '';

  if (c.stateManager === 'riverpod') {
    return `import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
${goRouterImport}
${cachedImageImport}
import '../providers/counter_provider.dart';
${hasBackend && c.router === 'go_router' ? "import '../../../../core/router/app_routes.dart';" : ''}
${autoRouteAnnotation}
class HomePage extends ConsumerWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(counterProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
${cachedImageWidget}
            Text(
              'Count: \$count',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FloatingActionButton(
                  heroTag: 'dec',
                  mini: true,
                  onPressed: () => ref.read(counterProvider.notifier).decrement(),
                  child: const Icon(Icons.remove),
                ),
                const SizedBox(width: 16),
                FloatingActionButton(
                  heroTag: 'inc',
                  onPressed: () => ref.read(counterProvider.notifier).increment(),
                  child: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => ref.read(counterProvider.notifier).reset(),
              child: const Text('Reset'),
            ),${loginButton}
          ],
        ),
      ),
    );
  }
}
`;
  }

  if (c.stateManager === 'bloc') {
    return `import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
${goRouterImport}
${cachedImageImport}
import '../bloc/home_bloc.dart';
${hasBackend && c.router === 'go_router' ? "import '../../../../core/router/app_routes.dart';" : ''}
${autoRouteAnnotation}
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return BlocProvider(
      create: (_) => HomeBloc(),
      child: const _HomeView(),
    );
  }
}

class _HomeView extends StatelessWidget {
  const _HomeView();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
        actions: [
          BlocBuilder<HomeBloc, HomeState>(
            builder: (context, state) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Center(child: Text('Count: \${state.count}', style: const TextStyle(fontWeight: FontWeight.bold))),
            ),
          ),
        ],
      ),
      body: BlocBuilder<HomeBloc, HomeState>(
        builder: (context, state) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
${cachedImageWidget}
                Text(
                  '\${state.count}',
                  style: Theme.of(context).textTheme.displayMedium,
                ),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    FloatingActionButton(
                      heroTag: 'dec',
                      mini: true,
                      onPressed: () => context.read<HomeBloc>().add(DecrementEvent()),
                      child: const Icon(Icons.remove),
                    ),
                    const SizedBox(width: 16),
                    FloatingActionButton(
                      heroTag: 'inc',
                      onPressed: () => context.read<HomeBloc>().add(IncrementEvent()),
                      child: const Icon(Icons.add),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => context.read<HomeBloc>().add(ResetEvent()),
                  child: const Text('Reset'),
                ),${loginButton}
              ],
            ),
          );
        },
      ),
    );
  }
}
`;
  }

  if (c.stateManager === 'provider') {
    return `import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
${goRouterImport}
${cachedImageImport}
import '../providers/home_provider.dart';
${hasBackend && c.router === 'go_router' ? "import '../../../../core/router/app_routes.dart';" : ''}
${autoRouteAnnotation}
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => HomeProvider(),
      child: const _HomeView(),
    );
  }
}

class _HomeView extends StatelessWidget {
  const _HomeView();

  @override
  Widget build(BuildContext context) {
    final count = context.watch<HomeProvider>().count;
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
${cachedImageWidget}
            Text('\$count', style: Theme.of(context).textTheme.displayMedium),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FloatingActionButton(
                  heroTag: 'dec',
                  mini: true,
                  onPressed: () => context.read<HomeProvider>().decrement(),
                  child: const Icon(Icons.remove),
                ),
                const SizedBox(width: 16),
                FloatingActionButton(
                  heroTag: 'inc',
                  onPressed: () => context.read<HomeProvider>().increment(),
                  child: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => context.read<HomeProvider>().reset(),
              child: const Text('Reset'),
            ),${loginButton}
          ],
        ),
      ),
    );
  }
}
`;
  }

  if (c.stateManager === 'getx') {
    return `import 'package:flutter/material.dart';
import 'package:get/get.dart';
${cachedImageImport}
import '../controllers/home_controller.dart';
${autoRouteAnnotation}
class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = Get.put(HomeController());
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
${cachedImageWidget}
            Obx(() => Text(
              '\${controller.count}',
              style: Theme.of(context).textTheme.displayMedium,
            )),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FloatingActionButton(
                  heroTag: 'dec',
                  mini: true,
                  onPressed: controller.decrement,
                  child: const Icon(Icons.remove),
                ),
                const SizedBox(width: 16),
                FloatingActionButton(
                  heroTag: 'inc',
                  onPressed: controller.increment,
                  child: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: controller.reset, child: const Text('Reset')),
${hasBackend ? `            const SizedBox(height: 12),\n            OutlinedButton.icon(\n              onPressed: () => Get.toNamed('/login'),\n              icon: const Icon(Icons.login),\n              label: const Text('Go to Login'),\n            ),` : ''}
          ],
        ),
      ),
    );
  }
}
`;
  }

  if (c.arch === 'mvvm') {
    return `import 'package:flutter/material.dart';
${goRouterImport}
${cachedImageImport}
import '../viewmodels/home_viewmodel.dart';
${hasBackend && c.router === 'go_router' ? "import '../../../../core/router/app_routes.dart';" : ''}
${autoRouteAnnotation}
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late final HomeViewModel _vm;

  @override
  void initState() {
    super.initState();
    _vm = HomeViewModel()..loadData();
  }

  @override
  void dispose() {
    _vm.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: ListenableBuilder(
        listenable: _vm,
        builder: (context, _) {
          if (_vm.isLoading) return const Center(child: CircularProgressIndicator());
          if (_vm.error != null) return Center(child: Text('Error: \${_vm.error}'));
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
${cachedImageWidget}
                Text('\${_vm.count}', style: Theme.of(context).textTheme.displayMedium),
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    FloatingActionButton(heroTag: 'dec', mini: true, onPressed: _vm.decrement, child: const Icon(Icons.remove)),
                    const SizedBox(width: 16),
                    FloatingActionButton(heroTag: 'inc', onPressed: _vm.increment, child: const Icon(Icons.add)),
                  ],
                ),
                const SizedBox(height: 12),
                TextButton(onPressed: _vm.reset, child: const Text('Reset')),${loginButton}
              ],
            ),
          );
        },
      ),
    );
  }
}
`;
  }

  // setState (none) / MVC — StatefulWidget
  const mvcImport = c.arch === 'mvc' ? "import '../controllers/home_controller.dart';" : '';
  return `import 'package:flutter/material.dart';
${goRouterImport}
${cachedImageImport}
${mvcImport}
${hasBackend && c.router === 'go_router' ? "import '../../../../core/router/app_routes.dart';" : ''}
${autoRouteAnnotation}
class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  ${c.arch === 'mvc' ? 'late final HomeController _controller;' : 'int _count = 0;'}

  @override
  void initState() {
    super.initState();
    ${c.arch === 'mvc' ? "_controller = HomeController(onUpdate: () => setState(() {}));" : ''}
  }

  ${c.arch === 'mvc' ? '' : `void _increment() => setState(() => _count++);
  void _decrement() => setState(() => _count--);
  void _reset()     => setState(() => _count = 0);`}

  @override
  Widget build(BuildContext context) {
    ${c.arch === 'mvc' ? 'final count = _controller.count;' : 'final count = _count;'}
    return Scaffold(
      appBar: AppBar(title: const Text('Home')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
${cachedImageWidget}
            Text('\$count', style: Theme.of(context).textTheme.displayMedium),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                FloatingActionButton(heroTag: 'dec', mini: true, onPressed: ${c.arch === 'mvc' ? '_controller.decrement' : '_decrement'}, child: const Icon(Icons.remove)),
                const SizedBox(width: 16),
                FloatingActionButton(heroTag: 'inc', onPressed: ${c.arch === 'mvc' ? '_controller.increment' : '_increment'}, child: const Icon(Icons.add)),
              ],
            ),
            const SizedBox(height: 12),
            TextButton(onPressed: ${c.arch === 'mvc' ? '_controller.reset' : '_reset'}, child: const Text('Reset')),${loginButton}
          ],
        ),
      ),
    );
  }
}
`;
}

function genRiverpodProvider() {
  return `import 'package:riverpod_annotation/riverpod_annotation.dart';
part 'counter_provider.g.dart';

@riverpod
class Counter extends _\$Counter {
  @override
  int build() => 0;

  void increment() => state++;
  void decrement() => state--;
  void reset()     => state = 0;
}
`;
}

function genHomeBloc() {
  return `import 'package:flutter_bloc/flutter_bloc.dart';
part 'home_event.dart';
part 'home_state.dart';

class HomeBloc extends Bloc<HomeEvent, HomeState> {
  HomeBloc() : super(const HomeState()) {
    on<IncrementEvent>((event, emit) => emit(state.copyWith(count: state.count + 1)));
    on<DecrementEvent>((event, emit) => emit(state.copyWith(count: state.count - 1)));
    on<ResetEvent>((event, emit) => emit(const HomeState()));
  }
}
`;
}

function genHomeBlocEvent() {
  return `part of 'home_bloc.dart';

abstract class HomeEvent {}

class IncrementEvent extends HomeEvent {}
class DecrementEvent extends HomeEvent {}
class ResetEvent     extends HomeEvent {}
`;
}

function genHomeBlocState() {
  return `part of 'home_bloc.dart';

class HomeState {
  final int count;
  const HomeState({this.count = 0});
  HomeState copyWith({int? count}) => HomeState(count: count ?? this.count);

  @override
  bool operator ==(Object other) => other is HomeState && other.count == count;
  @override
  int get hashCode => count.hashCode;
}
`;
}

function genProviderNotifier() {
  return `import 'package:flutter/foundation.dart';

class HomeProvider extends ChangeNotifier {
  int _count = 0;
  int get count => _count;

  void increment() { _count++; notifyListeners(); }
  void decrement() { _count--; notifyListeners(); }
  void reset()     { _count = 0; notifyListeners(); }
}
`;
}

function genGetXController() {
  return `import 'package:get/get.dart';

class HomeController extends GetxController {
  final _count = 0.obs;
  int get count => _count.value;

  void increment() => _count.value++;
  void decrement() => _count.value--;
  void reset()     => _count.value = 0;
}
`;
}

function genHomeViewModel() {
  return `import 'package:flutter/foundation.dart';

class HomeViewModel extends ChangeNotifier {
  int _count    = 0;
  bool _loading = false;
  String? _error;

  int     get count     => _count;
  bool    get isLoading => _loading;
  String? get error     => _error;

  void increment() { _count++; notifyListeners(); }
  void decrement() { _count--; notifyListeners(); }
  void reset()     { _count = 0; notifyListeners(); }

  Future<void> loadData() async {
    _loading = true; _error = null; notifyListeners();
    try {
      await Future.delayed(const Duration(milliseconds: 300));
      // TODO: load initial data from repository
    } catch (e) {
      _error = e.toString();
    } finally {
      _loading = false; notifyListeners();
    }
  }
}
`;
}

function genMvcController() {
  return `class HomeController {
  HomeController({required this.onUpdate});

  final VoidCallback onUpdate;
  int _count = 0;
  int get count => _count;

  void increment() { _count++; onUpdate(); }
  void decrement() { _count--; onUpdate(); }
  void reset()     { _count = 0; onUpdate(); }
}
`;
}

// ── Backend services ─────────────────────────────────────────────
function genSupabaseService() {
  return `import 'package:supabase_flutter/supabase_flutter.dart';

class SupabaseService {
  SupabaseService._();
  static final instance = SupabaseService._();

  SupabaseClient get client    => Supabase.instance.client;
  User?         get currentUser => client.auth.currentUser;
  bool          get isLoggedIn  => currentUser != null;

  Stream<AuthState> get authStateChanges => client.auth.onAuthStateChange;
}

// Shorthand for quick access
final supabase = SupabaseService.instance.client;
`;
}

function genFirebaseService() {
  return `import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class FirebaseService {
  FirebaseService._();
  static final instance = FirebaseService._();

  final auth      = FirebaseAuth.instance;
  final firestore = FirebaseFirestore.instance;

  User? get currentUser => auth.currentUser;
  bool  get isLoggedIn  => currentUser != null;

  Stream<User?> get authStateChanges => auth.authStateChanges();
}
`;
}

function genFirebaseOptions() {
  return `// TODO: Run \`flutterfire configure\` to generate this file.
// Alternatively copy from the Firebase console.
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart' show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) throw UnsupportedError('No web Firebase options configured.');
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        throw UnsupportedError('Run flutterfire configure to generate android options.');
      case TargetPlatform.iOS:
        throw UnsupportedError('Run flutterfire configure to generate iOS options.');
      default:
        throw UnsupportedError('Unsupported platform.');
    }
  }
}
`;
}

function genAuthRepo(c) {
  if (c.backend === 'supabase') {
    return `import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/services/supabase_service.dart';

class AuthRepository {
  final _client = SupabaseService.instance.client;

  Future<AuthResponse> signUp({required String email, required String password}) =>
      _client.auth.signUp(email: email, password: password);

  Future<AuthResponse> signIn({required String email, required String password}) =>
      _client.auth.signInWithPassword(email: email, password: password);

  Future<void> signOut() => _client.auth.signOut();

  User? get currentUser => _client.auth.currentUser;
  bool  get isLoggedIn  => currentUser != null;
}
`;
  }
  return `import 'package:firebase_auth/firebase_auth.dart';
import '../../../../core/services/firebase_service.dart';

class AuthRepository {
  final _auth = FirebaseService.instance.auth;

  Future<UserCredential> signUp({required String email, required String password}) =>
      _auth.createUserWithEmailAndPassword(email: email, password: password);

  Future<UserCredential> signIn({required String email, required String password}) =>
      _auth.signInWithEmailAndPassword(email: email, password: password);

  Future<void> signOut() => _auth.signOut();

  User? get currentUser => _auth.currentUser;
  bool  get isLoggedIn  => currentUser != null;
  Stream<User?> get authStateChanges => _auth.authStateChanges();
}
`;
}

function genLoginPage(c) {
  const autoAnnotation = c.router === 'auto_route' ? '\n@RoutePage()' : '';
  const navHome = c.router === 'go_router'
    ? "context.go(AppRoutes.home)"
    : c.router === 'auto_route'
      ? "context.router.replaceAll([const HomeRoute()])"
      : c.stateManager === 'getx'
        ? "Get.offAllNamed('/')"
        : "Navigator.pushReplacementNamed(context, '/')";
  const goImport = c.router === 'go_router' ? "import 'package:go_router/go_router.dart';\nimport '../../../../core/router/app_routes.dart';" : '';
  const arImport = c.router === 'auto_route' ? "import 'package:auto_route/auto_route.dart';\nimport '../../../../core/router/app_router.dart';" : '';
  const getImport = c.stateManager === 'getx' ? "import 'package:get/get.dart';" : '';

  return `import 'package:flutter/material.dart';
${goImport}
${arImport}
${getImport}
import '../../data/repositories/auth_repository.dart';
${autoAnnotation}
class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey   = GlobalKey<FormState>();
  final _emailCtrl = TextEditingController();
  final _passCtrl  = TextEditingController();
  final _repo      = AuthRepository();

  bool _loading = false;
  bool _obscure = true;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _loading = true);
    try {
      await _repo.signIn(
        email: _emailCtrl.text.trim(),
        password: _passCtrl.text.trim(),
      );
      if (mounted) ${navHome};
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.lock_outline, size: 64),
                const SizedBox(height: 24),
                TextFormField(
                  controller: _emailCtrl,
                  decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined)),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _passCtrl,
                  obscureText: _obscure,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscure ? Icons.visibility : Icons.visibility_off),
                      onPressed: () => setState(() => _obscure = !_obscure),
                    ),
                  ),
                  validator: (v) => (v == null || v.length < 6) ? 'Min 6 characters' : null,
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: _loading ? null : _submit,
                  child: _loading ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Sign in'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _loading ? null : () async {
                    if (!_formKey.currentState!.validate()) return;
                    setState(() => _loading = true);
                    try {
                      await _repo.signUp(
                        email: _emailCtrl.text.trim(),
                        password: _passCtrl.text.trim(),
                      );
                      if (mounted) ${navHome};
                    } catch (e) {
                      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
                    } finally {
                      if (mounted) setState(() => _loading = false);
                    }
                  },
                  child: const Text('Create account'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
`;
}

// ── Network ───────────────────────────────────────────────────────
function genApiClient() {
  return `import 'package:dio/dio.dart';
import 'api_interceptor.dart';
import '../constants/app_constants.dart';

class ApiClient {
  ApiClient._();
  static final instance = ApiClient._();

  late final Dio _dio = Dio(
    BaseOptions(
      baseUrl: AppConstants.apiBaseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: {'Content-Type': 'application/json'},
    ),
  )..interceptors.addAll([
    ApiInterceptor(),
    LogInterceptor(requestBody: true, responseBody: true),
  ]);

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? params}) =>
      _dio.get(path, queryParameters: params);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post(path, data: data);

  Future<Response<T>> put<T>(String path, {dynamic data}) =>
      _dio.put(path, data: data);

  Future<Response<T>> delete<T>(String path) =>
      _dio.delete(path);
}
`;
}

function genApiInterceptor() {
  return `import 'package:dio/dio.dart';

class ApiInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    // TODO: inject auth token
    // options.headers['Authorization'] = 'Bearer \$token';
    super.onRequest(options, handler);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    super.onResponse(response, handler);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    // Handle 401 → refresh token, 500 → log to Sentry, etc.
    super.onError(err, handler);
  }
}
`;
}

// ── Storage ───────────────────────────────────────────────────────
function genHiveService() {
  return `import 'package:hive_flutter/hive_flutter.dart';

class HiveService {
  HiveService._();
  static final instance = HiveService._();

  static const _settingsBox = 'settings';

  static Future<void> init() async {
    await Hive.initFlutter();
    // Register type adapters before opening boxes:
    // Hive.registerAdapter(YourModelAdapter());
    await Hive.openBox<dynamic>(_settingsBox);
  }

  Box<dynamic> get settings => Hive.box<dynamic>(_settingsBox);

  Future<void> put(String key, dynamic value) => settings.put(key, value);
  T?    get<T>(String key, {T? defaultValue})  => settings.get(key, defaultValue: defaultValue) as T?;
  Future<void> delete(String key)              => settings.delete(key);
  Future<void> clear()                         => settings.clear();
}
`;
}

function genStorageService() {
  return `import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  StorageService._();
  static final instance = StorageService._();

  late SharedPreferences _prefs;

  static Future<void> init() async {
    instance._prefs = await SharedPreferences.getInstance();
  }

  Future<bool> setString(String key, String value) => _prefs.setString(key, value);
  String?      getString(String key)                => _prefs.getString(key);

  Future<bool> setBool(String key, bool value) => _prefs.setBool(key, value);
  bool?        getBool(String key)             => _prefs.getBool(key);

  Future<bool> setInt(String key, int value) => _prefs.setInt(key, value);
  int?         getInt(String key)            => _prefs.getInt(key);

  Future<bool> remove(String key) => _prefs.remove(key);
  Future<bool> clear()            => _prefs.clear();
}
`;
}

function genImagePickerService() {
  return `import 'dart:io';
import 'package:image_picker/image_picker.dart';

class ImagePickerService {
  ImagePickerService._();
  static final instance = ImagePickerService._();

  final _picker = ImagePicker();

  Future<File?> pickFromGallery({double? maxWidth, double? maxHeight, int? quality}) async {
    final picked = await _picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: maxWidth,
      maxHeight: maxHeight,
      imageQuality: quality ?? 85,
    );
    return picked != null ? File(picked.path) : null;
  }

  Future<File?> pickFromCamera({double? maxWidth, double? maxHeight}) async {
    final picked = await _picker.pickImage(
      source: ImageSource.camera,
      maxWidth: maxWidth,
      maxHeight: maxHeight,
      imageQuality: 85,
    );
    return picked != null ? File(picked.path) : null;
  }

  Future<List<File>> pickMultiple() async {
    final picked = await _picker.pickMultiImage(imageQuality: 85);
    return picked.map((x) => File(x.path)).toList();
  }
}
`;
}

// ── Domain ────────────────────────────────────────────────────────
function genHomeEntity(useFreezed) {
  if (useFreezed) {
    return `import 'package:freezed_annotation/freezed_annotation.dart';
part 'home_entity.freezed.dart';
part 'home_entity.g.dart';

@freezed
class HomeEntity with _\$HomeEntity {
  const factory HomeEntity({
    required String id,
    required String title,
    String? description,
    @Default(false) bool isCompleted,
    required DateTime createdAt,
  }) = _HomeEntity;

  factory HomeEntity.fromJson(Map<String, dynamic> json) =>
      _\$HomeEntityFromJson(json);
}
`;
  }
  return `class HomeEntity {
  const HomeEntity({
    required this.id,
    required this.title,
    this.description,
    this.isCompleted = false,
    required this.createdAt,
  });

  final String   id;
  final String   title;
  final String?  description;
  final bool     isCompleted;
  final DateTime createdAt;

  HomeEntity copyWith({
    String? id, String? title, String? description,
    bool? isCompleted, DateTime? createdAt,
  }) => HomeEntity(
    id:          id          ?? this.id,
    title:       title       ?? this.title,
    description: description ?? this.description,
    isCompleted: isCompleted ?? this.isCompleted,
    createdAt:   createdAt   ?? this.createdAt,
  );
}
`;
}

function genHomeRepositoryInterface() {
  return `import '../entities/home_entity.dart';

abstract class HomeRepository {
  Future<List<HomeEntity>> getAll();
  Future<HomeEntity>       getById(String id);
  Future<HomeEntity>       create(HomeEntity entity);
  Future<HomeEntity>       update(HomeEntity entity);
  Future<void>             delete(String id);
}
`;
}

function genHomeUseCase() {
  return `import '../entities/home_entity.dart';
import '../repositories/home_repository.dart';

class GetHomeDataUseCase {
  const GetHomeDataUseCase(this._repository);
  final HomeRepository _repository;

  Future<List<HomeEntity>> call() => _repository.getAll();
}
`;
}

function genHomeRepoImpl(c) {
  const supabase = c.backend === 'supabase';
  const firebase = c.backend === 'firebase';
  if (supabase) {
    return `import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../../core/services/supabase_service.dart';
import '../../domain/entities/home_entity.dart';
import '../../domain/repositories/home_repository.dart';

class HomeRepositoryImpl implements HomeRepository {
  final _client = SupabaseService.instance.client;
  static const _table = 'home_items';

  @override
  Future<List<HomeEntity>> getAll() async {
    final data = await _client.from(_table).select().order('created_at');
    return (data as List).map((e) => HomeEntity.fromJson(e)).toList();
  }

  @override
  Future<HomeEntity> getById(String id) async {
    final data = await _client.from(_table).select().eq('id', id).single();
    return HomeEntity.fromJson(data);
  }

  @override
  Future<HomeEntity> create(HomeEntity entity) async {
    final data = await _client.from(_table).insert(entity.toJson()).select().single();
    return HomeEntity.fromJson(data);
  }

  @override
  Future<HomeEntity> update(HomeEntity entity) async {
    final data = await _client.from(_table).update(entity.toJson()).eq('id', entity.id).select().single();
    return HomeEntity.fromJson(data);
  }

  @override
  Future<void> delete(String id) => _client.from(_table).delete().eq('id', id);
}
`;
  }
  if (firebase) {
    return `import 'package:cloud_firestore/cloud_firestore.dart';
import '../../../../core/services/firebase_service.dart';
import '../../domain/entities/home_entity.dart';
import '../../domain/repositories/home_repository.dart';

class HomeRepositoryImpl implements HomeRepository {
  final _db = FirebaseService.instance.firestore;
  CollectionReference get _col => _db.collection('home_items');

  @override
  Future<List<HomeEntity>> getAll() async {
    final snap = await _col.orderBy('createdAt', descending: true).get();
    return snap.docs.map((d) => HomeEntity.fromJson({...d.data() as Map<String, dynamic>, 'id': d.id})).toList();
  }

  @override
  Future<HomeEntity> getById(String id) async {
    final doc = await _col.doc(id).get();
    return HomeEntity.fromJson({...doc.data() as Map<String, dynamic>, 'id': doc.id});
  }

  @override
  Future<HomeEntity> create(HomeEntity entity) async {
    final ref = await _col.add(entity.toJson());
    final doc = await ref.get();
    return HomeEntity.fromJson({...doc.data() as Map<String, dynamic>, 'id': doc.id});
  }

  @override
  Future<HomeEntity> update(HomeEntity entity) async {
    await _col.doc(entity.id).update(entity.toJson());
    return entity;
  }

  @override
  Future<void> delete(String id) => _col.doc(id).delete();
}
`;
  }
  return '';
}

// ── Tests ─────────────────────────────────────────────────────────
function genWidgetTest(c) {
  return `import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
${c.stateManager === 'riverpod' ? "import 'package:flutter_riverpod/flutter_riverpod.dart';" : ''}
import 'package:${c.appName}/app.dart';

void main() {
  testWidgets('App launches successfully', (WidgetTester tester) async {
    await tester.pumpWidget(${c.stateManager === 'riverpod' ? 'const ProviderScope(child: App())' : 'const App()'});
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
`;
}

function genBlocTest(appName) {
  return `import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:${appName}/features/home/presentation/bloc/home_bloc.dart';

void main() {
  group('HomeBloc', () {
    late HomeBloc bloc;

    setUp(() => bloc = HomeBloc());
    tearDown(() => bloc.close());

    test('initial state is HomeState(count: 0)', () {
      expect(bloc.state, const HomeState());
    });

    test('IncrementEvent increments count', () async {
      bloc.add(IncrementEvent());
      await expectLater(bloc.stream, emits(const HomeState(count: 1)));
    });

    test('DecrementEvent decrements count', () async {
      bloc.add(IncrementEvent());
      bloc.add(DecrementEvent());
      await expectLater(bloc.stream, emitsInOrder([
        const HomeState(count: 1),
        const HomeState(count: 0),
      ]));
    });

    test('ResetEvent resets count', () async {
      bloc.add(IncrementEvent());
      bloc.add(ResetEvent());
      await expectLater(bloc.stream, emitsInOrder([
        const HomeState(count: 1),
        const HomeState(count: 0),
      ]));
    });
  });
}
`;
}

function genAnalysisOptions() {
  return `include: package:flutter_lints/flutter.yaml

linter:
  rules:
    - avoid_print
    - prefer_const_constructors
    - prefer_const_literals_to_create_immutables
    - sized_box_for_whitespace
    - use_key_in_widget_constructors
    - prefer_single_quotes
    - always_declare_return_types
`;
}

function genGitignore() {
  return `# Flutter
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
build/

# Generated files
*.g.dart
*.freezed.dart
*.gr.dart

# Android
**/android/**/gradle-wrapper.jar
**/android/.gradle
**/android/captures/
**/android/gradlew
**/android/gradlew.bat
**/android/local.properties
**/android/**/GeneratedPluginRegistrant.java
**/android/key.properties
*.jks

# iOS
**/ios/**/*.mode1v3
**/ios/**/*.moved-aside
**/ios/**/*.pbxuser
**/ios/**/*.perspectivev3
**/ios/**/DerivedData/
**/ios/**/xcuserdata
**/ios/.generated/
**/ios/Flutter/flutter_export_environment.sh
**/ios/Flutter/Generated.xcconfig

# Secrets
*.env
.env.*
`;
}

function genReadme(c) {
  const stateLabel = { riverpod: 'Riverpod', bloc: 'Bloc', provider: 'Provider', getx: 'GetX', none: 'setState' }[c.stateManager];
  const routerLabel = { go_router: 'GoRouter', auto_route: 'AutoRoute', default: 'Navigator' }[c.router];
  const backendLabel = { supabase: 'Supabase', firebase: 'Firebase', none: 'None' }[c.backend];
  const archLabel = { feature: 'Feature-first', clean: 'Clean Architecture', mvvm: 'MVVM', mvc: 'MVC' }[c.arch];
  const needsBuildRunner = c.stateManager === 'riverpod' || c.router === 'auto_route' || c.packages.includes('freezed');

  return `# ${c.displayName}

${c.description}

---

## Stack

| Concern       | Choice              |
|---------------|---------------------|
| State         | ${stateLabel}       |
| Routing       | ${routerLabel}      |
| Backend       | ${backendLabel}     |
| Platforms     | ${c.platforms.join(', ')} |
| Architecture  | ${archLabel}        |

---

## Getting started

\`\`\`bash
flutter pub get
${needsBuildRunner ? 'dart run build_runner build --delete-conflicting-outputs' : ''}
flutter run${c.backend === 'supabase' ? ' --dart-define-from-file=.env' : ''}
\`\`\`

${c.backend === 'supabase' ? '## Supabase setup\n\nCopy `.env.example` → `.env` and fill in your project URL and anon key.\n' : ''}
${c.backend === 'firebase' ? '## Firebase setup\n\nRun `flutterfire configure` to auto-generate `firebase_options.dart`.\n' : ''}
## Project structure

\`\`\`
lib/
├── core/
│   ├── constants/     # AppConstants
${c.darkMode ? '│   ├── theme/         # AppTheme (light + dark)\n' : ''}${c.router !== 'default' ? '│   ├── router/        # Router config + route names\n' : ''}${c.packages.includes('dio') ? '│   ├── network/       # ApiClient (Dio) + interceptors\n' : ''}${c.backend !== 'none' ? '│   └── services/      # Backend service singleton\n' : '├── ...\n'}├── features/
│   ├── home/
│   │   ├── data/      # Repository impl + datasources
│   │   ├── domain/    # Entities + repository interface + use cases
│   │   └── presentation/
│   │       ├── pages/
${c.stateManager === 'bloc' ? '│   │       └── bloc/  # HomeBloc + Events + States\n' : ''}${c.stateManager === 'riverpod' ? '│   │       └── providers/ # counterProvider (riverpod_annotation)\n' : ''}${c.stateManager === 'provider' ? '│   │       └── providers/ # HomeProvider (ChangeNotifier)\n' : ''}${c.stateManager === 'getx' ? '│   │       └── controllers/ # HomeController (GetxController)\n' : ''}${c.arch === 'mvvm' ? '│   │       └── viewmodels/ # HomeViewModel (ChangeNotifier)\n' : ''}${c.backend !== 'none' ? '│   └── auth/\n│       ├── data/repositories/auth_repository.dart\n│       └── presentation/pages/login_page.dart\n' : ''}└── main.dart
\`\`\`

---
*Generated with Orbit Flutter Init*
`;
}

function genEnvExample(c) {
  if (c.backend === 'supabase') {
    return `SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
`;
  }
  return '';
}

// ─── ZIP builder ──────────────────────────────────────────────────
async function buildZip(c) {
  const zip = new JSZip();
  const root = zip.folder(c.appName);

  // ── Root files ────────────────────────────────────────────────
  root.file('pubspec.yaml', genPubspec(c));
  root.file('.gitignore', genGitignore());
  root.file('README.md', genReadme(c));
  if (c.lints) root.file('analysis_options.yaml', genAnalysisOptions());
  if (c.backend === 'supabase') root.file('.env.example', genEnvExample(c));

  // ── lib/ ──────────────────────────────────────────────────────
  const lib = root.folder('lib');
  lib.file('main.dart', genMain(c));
  lib.file('app.dart', genApp(c));
  if (c.backend === 'firebase') lib.file('firebase_options.dart', genFirebaseOptions());

  // ── lib/core/ ─────────────────────────────────────────────────
  const core = lib.folder('core');
  core.folder('constants').file('app_constants.dart', genAppConstants(c));
  if (c.darkMode) core.folder('theme').file('app_theme.dart', genAppTheme());

  // Router
  if (c.router === 'go_router') {
    core.folder('router').file('app_router.dart', genGoRouter(c));
    core.folder('router').file('app_routes.dart', genAppRoutes());
  } else if (c.router === 'auto_route') {
    core.folder('router').file('app_router.dart', genAutoRouter(c));
  }

  // Network
  if (c.packages.includes('dio')) {
    const net = core.folder('network');
    net.file('api_client.dart', genApiClient());
    net.file('api_interceptor.dart', genApiInterceptor());
  }

  // Services
  const svc = core.folder('services');
  if (c.backend === 'supabase') svc.file('supabase_service.dart', genSupabaseService());
  if (c.backend === 'firebase') svc.file('firebase_service.dart', genFirebaseService());
  if (c.packages.includes('hive')) svc.file('hive_service.dart', genHiveService());
  if (c.packages.includes('shared_prefs')) svc.file('storage_service.dart', genStorageService());
  if (c.packages.includes('image_picker')) svc.file('image_picker_service.dart', genImagePickerService());

  // ── lib/features/home/ ────────────────────────────────────────
  const home = lib.folder('features').folder('home');

  // Domain layer (always)
  const domain = home.folder('domain');
  domain.folder('entities').file('home_entity.dart', genHomeEntity(c.packages.includes('freezed')));
  domain.folder('repositories').file('home_repository.dart', genHomeRepositoryInterface());
  domain.folder('usecases').file('get_home_data.dart', genHomeUseCase());

  // Data layer
  const data = home.folder('data');
  if (c.backend !== 'none') {
    data.folder('repositories').file('home_repository_impl.dart', genHomeRepoImpl(c));
  }

  // Presentation layer
  const pres = home.folder('presentation');
  pres.folder('pages').file('home_page.dart', genHomePage(c));

  if (c.stateManager === 'riverpod') {
    pres.folder('providers').file('counter_provider.dart', genRiverpodProvider());
  } else if (c.stateManager === 'bloc') {
    const blocDir = pres.folder('bloc');
    blocDir.file('home_bloc.dart', genHomeBloc());
    blocDir.file('home_event.dart', genHomeBlocEvent());
    blocDir.file('home_state.dart', genHomeBlocState());
  } else if (c.stateManager === 'provider') {
    pres.folder('providers').file('home_provider.dart', genProviderNotifier());
  } else if (c.stateManager === 'getx') {
    pres.folder('controllers').file('home_controller.dart', genGetXController());
  }

  if (c.arch === 'mvvm') pres.folder('viewmodels').file('home_viewmodel.dart', genHomeViewModel());
  if (c.arch === 'mvc') pres.folder('controllers').file('home_controller.dart', genMvcController());

  // ── lib/features/auth/ (backend) ────────────────────────────
  if (c.backend !== 'none') {
    const auth = lib.folder('features').folder('auth');
    auth.folder('data').folder('repositories').file('auth_repository.dart', genAuthRepo(c));
    auth.folder('presentation').folder('pages').file('login_page.dart', genLoginPage(c));
  }

  // ── l10n ──────────────────────────────────────────────────────
  if (c.i18n) {
    lib.folder('l10n').file('app_en.arb', JSON.stringify({
      '@@locale': 'en',
      'appTitle': c.displayName,
      'counter': 'Count: {count}',
      '@counter': { description: 'Counter label', placeholders: { count: { type: 'int' } } },
    }, null, 2));
    root.file('l10n.yaml', `arb-dir: lib/l10n\ntemplate-arb-file: app_en.arb\noutput-localization-file: app_localizations.dart\n`);
  }

  // ── Assets ────────────────────────────────────────────────────
  root.folder('assets').folder('images');
  root.folder('assets').folder('icons');

  // ── test/ ─────────────────────────────────────────────────────
  const test = root.folder('test');
  test.file('widget_test.dart', genWidgetTest(c));
  if (c.stateManager === 'bloc') {
    test.folder('features/home/bloc').file('home_bloc_test.dart', genBlocTest(c.appName));
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${c.appName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Step components ───────────────────────────────────────────────

function StepInfo({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v });
  const slugify = v => v.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_').slice(0, 40);
  return (
    <div className="fi-fields">
      <div className="fi-fld">
        <label>App name (snake_case)</label>
        <input
          value={config.appName}
          onChange={e => set('appName', slugify(e.target.value))}
          placeholder="my_flutter_app"
          className="fi-input"
        />
        <span className="fi-hint">Used as the package name in pubspec.yaml</span>
      </div>
      <div className="fi-fld">
        <label>Display name</label>
        <input value={config.displayName} onChange={e => set('displayName', e.target.value)} placeholder="My Flutter App" className="fi-input" />
        <span className="fi-hint">Shown in title bar and on device</span>
      </div>
      <div className="fi-fld">
        <label>Bundle ID</label>
        <input value={config.bundleId} onChange={e => set('bundleId', e.target.value)} placeholder="com.example.app" className="fi-input" />
        <span className="fi-hint">Reverse domain notation — used for Android and iOS</span>
      </div>
      <div className="fi-fld">
        <label>Description</label>
        <input value={config.description} onChange={e => set('description', e.target.value)} placeholder="A new Flutter app." className="fi-input" />
      </div>
    </div>
  );
}

function StepPlatform({ config, onChange }) {
  const toggle = (p) => {
    const next = config.platforms.includes(p)
      ? config.platforms.filter(x => x !== p)
      : [...config.platforms, p];
    if (next.length === 0) return;
    onChange({ ...config, platforms: next });
  };
  const PLATFORMS = [
    { id: 'android', label: 'Android', icon: '🤖' },
    { id: 'ios', label: 'iOS', icon: '🍎' },
    { id: 'web', label: 'Web', icon: '🌐' },
    { id: 'macos', label: 'macOS', icon: '💻' },
    { id: 'windows', label: 'Windows', icon: '🪟' },
    { id: 'linux', label: 'Linux', icon: '🐧' },
  ];
  return (
    <div className="fi-choice-grid">
      {PLATFORMS.map(p => (
        <button
          key={p.id}
          className={'fi-choice' + (config.platforms.includes(p.id) ? ' selected' : '')}
          onClick={() => toggle(p.id)}
        >
          <span className="fi-choice-icon">{p.icon}</span>
          <span className="fi-choice-label">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

function StepState({ config, onChange }) {
  const OPTIONS = [
    { id: 'riverpod', label: 'Riverpod', desc: 'Compile-safe, composable providers. Recommended.', badge: 'POPULAR' },
    { id: 'bloc', label: 'Bloc', desc: 'BLoC/Cubit pattern for predictable state flows.', badge: '' },
    { id: 'provider', label: 'Provider', desc: 'Lightweight InheritedWidget wrapper by Remi.', badge: '' },
    { id: 'getx', label: 'GetX', desc: 'All-in-one: state + routing + DI in one package.', badge: '' },
    { id: 'none', label: 'setState', desc: 'No extra package. Use Flutter built-ins only.', badge: '' },
  ];
  return (
    <div className="fi-radio-list">
      {OPTIONS.map(o => (
        <button
          key={o.id}
          className={'fi-radio' + (config.stateManager === o.id ? ' selected' : '')}
          onClick={() => onChange({ ...config, stateManager: o.id })}
        >
          <div className="fi-radio-dot" />
          <div className="fi-radio-body">
            <div className="fi-radio-label">{o.label} {o.badge && <span className="fi-badge">{o.badge}</span>}</div>
            <div className="fi-radio-desc">{o.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StepRouter({ config, onChange }) {
  const OPTIONS = [
    { id: 'go_router', label: 'GoRouter', desc: 'Official Flutter routing package. Deep linking, nested routes.' },
    { id: 'auto_route', label: 'AutoRoute', desc: 'Code-gen based typed routing. Great with clean arch.' },
    { id: 'default', label: 'Navigator 2.0', desc: 'Flutter built-in. No extra dependency.' },
  ];
  return (
    <div className="fi-radio-list">
      {OPTIONS.map(o => (
        <button
          key={o.id}
          className={'fi-radio' + (config.router === o.id ? ' selected' : '')}
          onClick={() => onChange({ ...config, router: o.id })}
        >
          <div className="fi-radio-dot" />
          <div className="fi-radio-body">
            <div className="fi-radio-label">{o.label}</div>
            <div className="fi-radio-desc">{o.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StepBackend({ config, onChange }) {
  const OPTIONS = [
    { id: 'supabase', label: 'Supabase', desc: 'Postgres + Auth + Storage + Realtime. Open source BaaS.', icon: '⚡' },
    { id: 'firebase', label: 'Firebase', desc: 'Google BaaS: Firestore, Auth, Storage, Analytics.', icon: '🔥' },
    { id: 'none', label: 'None', desc: 'No backend integration. Add your own later.', icon: '○' },
  ];
  return (
    <div className="fi-radio-list">
      {OPTIONS.map(o => (
        <button
          key={o.id}
          className={'fi-radio' + (config.backend === o.id ? ' selected' : '')}
          onClick={() => onChange({ ...config, backend: o.id })}
        >
          <span className="fi-radio-icon">{o.icon}</span>
          <div className="fi-radio-body">
            <div className="fi-radio-label">{o.label}</div>
            <div className="fi-radio-desc">{o.desc}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

function StepPackages({ config, onChange }) {
  const toggle = (id) => {
    const next = config.packages.includes(id)
      ? config.packages.filter(x => x !== id)
      : [...config.packages, id];
    onChange({ ...config, packages: next });
  };
  const GROUPS = [
    {
      label: 'HTTP', items: [
        { id: 'dio', name: 'Dio', desc: 'Powerful HTTP client with interceptors', ver: PKG.dio },
        { id: 'http', name: 'http', desc: 'Official Dart HTTP package', ver: PKG.http },
      ]
    },
    {
      label: 'Local Storage', items: [
        { id: 'hive', name: 'Hive', desc: 'Fast key-value NoSQL store', ver: PKG.hive },
        { id: 'shared_prefs', name: 'shared_preferences', desc: 'Simple key-value persistence', ver: PKG.shared_preferences },
      ]
    },
    {
      label: 'UI / Media', items: [
        { id: 'cached_image', name: 'Cached Network Image', desc: 'Image caching with placeholder', ver: PKG.cached_network_image },
        { id: 'image_picker', name: 'Image Picker', desc: 'Camera and gallery access', ver: PKG.image_picker },
      ]
    },
    {
      label: 'Code Gen', items: [
        { id: 'freezed', name: 'Freezed', desc: 'Immutable models + union types + copyWith', ver: PKG.freezed_annotation },
        { id: 'path_provider', name: 'Path Provider', desc: 'Device file system paths', ver: PKG.path_provider },
      ]
    },
  ];
  return (
    <div className="fi-pkg-groups">
      {GROUPS.map(g => (
        <div key={g.label} className="fi-pkg-group">
          <div className="fi-pkg-group-label">{g.label}</div>
          {g.items.map(pkg => (
            <button
              key={pkg.id}
              className={'fi-pkg-row' + (config.packages.includes(pkg.id) ? ' selected' : '')}
              onClick={() => toggle(pkg.id)}
            >
              <div className={'fi-check' + (config.packages.includes(pkg.id) ? ' on' : '')} />
              <div className="fi-pkg-body">
                <div className="fi-pkg-name">{pkg.name}</div>
                <div className="fi-pkg-desc">{pkg.desc}</div>
              </div>
              <div className="fi-pkg-ver">{pkg.ver}</div>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function StepArch({ config, onChange }) {
  const set = (k, v) => onChange({ ...config, [k]: v });
  const ARCHS = [
    { id: 'feature', label: 'Feature-first', desc: 'lib/features/home/{data,domain,presentation}. Simple and scalable.' },
    { id: 'clean', label: 'Clean Architecture', desc: 'lib/{data,domain,presentation} layers strictly separated.' },
    { id: 'mvvm', label: 'MVVM', desc: 'Model-View-ViewModel with ViewModels as ChangeNotifiers.' },
    { id: 'mvc', label: 'MVC', desc: 'Classic Model-View-Controller split.' },
  ];
  const EXTRAS = [
    { id: 'darkMode', label: 'Dark mode support', desc: 'Generates AppTheme with light + dark ThemeData.' },
    { id: 'i18n', label: 'Localization (i18n)', desc: 'Creates l10n/ ARB files and flutter_localizations dep.' },
    { id: 'flavors', label: 'App flavors', desc: 'Adds README notes for dev/staging/prod flavor setup.' },
    { id: 'lints', label: 'Custom lint rules', desc: 'Generates analysis_options.yaml with recommended rules.' },
  ];
  return (
    <div>
      <div className="fi-radio-list" style={{ marginBottom: 20 }}>
        {ARCHS.map(a => (
          <button
            key={a.id}
            className={'fi-radio' + (config.arch === a.id ? ' selected' : '')}
            onClick={() => set('arch', a.id)}
          >
            <div className="fi-radio-dot" />
            <div className="fi-radio-body">
              <div className="fi-radio-label">{a.label}</div>
              <div className="fi-radio-desc">{a.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="fi-pkg-group-label" style={{ marginBottom: 10 }}>EXTRAS</div>
      <div className="fi-extras-grid">
        {EXTRAS.map(ex => (
          <button
            key={ex.id}
            className={'fi-pkg-row' + (config[ex.id] ? ' selected' : '')}
            onClick={() => set(ex.id, !config[ex.id])}
          >
            <div className={'fi-check' + (config[ex.id] ? ' on' : '')} />
            <div className="fi-pkg-body">
              <div className="fi-pkg-name">{ex.label}</div>
              <div className="fi-pkg-desc">{ex.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function StepGenerate({ config, onGenerate, generating }) {
  const stateLabel = { riverpod: 'Riverpod', bloc: 'Bloc', provider: 'Provider', getx: 'GetX', none: 'setState' };
  const routerLabel = { go_router: 'GoRouter', auto_route: 'AutoRoute', default: 'Navigator' };
  const backendLabel = { supabase: 'Supabase', firebase: 'Firebase', none: 'None' };

  const allDeps = useMemo(() => {
    const d = [];
    if (config.stateManager === 'riverpod') { d.push('flutter_riverpod', 'riverpod_annotation'); }
    else if (config.stateManager === 'bloc') { d.push('flutter_bloc', 'bloc', 'equatable'); }
    else if (config.stateManager === 'provider') d.push('provider');
    else if (config.stateManager === 'getx') d.push('get');
    if (config.router === 'go_router') d.push('go_router');
    if (config.router === 'auto_route') d.push('auto_route');
    if (config.backend === 'supabase') d.push('supabase_flutter');
    if (config.backend === 'firebase') d.push('firebase_core', 'firebase_auth', 'cloud_firestore');
    if (config.packages.includes('dio')) d.push('dio');
    if (config.packages.includes('http')) d.push('http');
    if (config.packages.includes('hive')) d.push('hive_flutter');
    if (config.packages.includes('shared_prefs')) d.push('shared_preferences');
    if (config.packages.includes('cached_image')) d.push('cached_network_image');
    if (config.packages.includes('image_picker')) d.push('image_picker');
    if (config.packages.includes('freezed')) d.push('freezed_annotation');
    if (config.i18n) d.push('intl');
    return d;
  }, [config]);

  const files = [
    // Root
    'pubspec.yaml', '.gitignore', 'README.md',
    config.lints && 'analysis_options.yaml',
    config.backend === 'supabase' && '.env.example',
    config.i18n && 'l10n.yaml',
    // Lib core
    'lib/main.dart', 'lib/app.dart',
    config.backend === 'firebase' && 'lib/firebase_options.dart',
    'lib/core/constants/app_constants.dart',
    config.darkMode && 'lib/core/theme/app_theme.dart',
    // Routing
    config.router === 'go_router' && 'lib/core/router/app_router.dart',
    config.router === 'go_router' && 'lib/core/router/app_routes.dart',
    config.router === 'auto_route' && 'lib/core/router/app_router.dart',
    // Network
    config.packages.includes('dio') && 'lib/core/network/api_client.dart',
    config.packages.includes('dio') && 'lib/core/network/api_interceptor.dart',
    // Services
    config.backend === 'supabase' && 'lib/core/services/supabase_service.dart',
    config.backend === 'firebase' && 'lib/core/services/firebase_service.dart',
    config.packages.includes('hive') && 'lib/core/services/hive_service.dart',
    config.packages.includes('shared_prefs') && 'lib/core/services/storage_service.dart',
    config.packages.includes('image_picker') && 'lib/core/services/image_picker_service.dart',
    // Domain
    'lib/features/home/domain/entities/home_entity.dart',
    'lib/features/home/domain/repositories/home_repository.dart',
    'lib/features/home/domain/usecases/get_home_data.dart',
    // Data
    config.backend !== 'none' && 'lib/features/home/data/repositories/home_repository_impl.dart',
    // Presentation
    'lib/features/home/presentation/pages/home_page.dart',
    config.stateManager === 'riverpod' && 'lib/features/home/presentation/providers/counter_provider.dart',
    config.stateManager === 'bloc' && 'lib/features/home/presentation/bloc/home_bloc.dart',
    config.stateManager === 'bloc' && 'lib/features/home/presentation/bloc/home_event.dart',
    config.stateManager === 'bloc' && 'lib/features/home/presentation/bloc/home_state.dart',
    config.stateManager === 'provider' && 'lib/features/home/presentation/providers/home_provider.dart',
    config.stateManager === 'getx' && 'lib/features/home/presentation/controllers/home_controller.dart',
    config.arch === 'mvvm' && 'lib/features/home/presentation/viewmodels/home_viewmodel.dart',
    config.arch === 'mvc' && 'lib/features/home/presentation/controllers/home_controller.dart',
    // Auth
    config.backend !== 'none' && 'lib/features/auth/data/repositories/auth_repository.dart',
    config.backend !== 'none' && 'lib/features/auth/presentation/pages/login_page.dart',
    // i18n
    config.i18n && 'lib/l10n/app_en.arb',
    // Tests
    'test/widget_test.dart',
    config.stateManager === 'bloc' && 'test/features/home/bloc/home_bloc_test.dart',
  ].filter(Boolean);

  return (
    <div className="fi-generate">
      <div className="fi-summary-grid">
        {[
          ['App name', config.appName],
          ['Bundle ID', config.bundleId],
          ['Platforms', config.platforms.join(', ')],
          ['State', stateLabel[config.stateManager] || config.stateManager],
          ['Routing', routerLabel[config.router] || config.router],
          ['Backend', backendLabel[config.backend] || config.backend],
          ['Architecture', config.arch === 'feature' ? 'Feature-first' : config.arch === 'clean' ? 'Clean Arch' : config.arch.toUpperCase()],
        ].map(([k, v]) => (
          <div key={k} className="fi-summary-row">
            <span className="fi-summary-k">{k}</span>
            <span className="fi-summary-v">{v}</span>
          </div>
        ))}
      </div>

      <div className="fi-deps-section">
        <div className="fi-pkg-group-label">DEPENDENCIES ({allDeps.length})</div>
        <div className="fi-deps-list">
          {allDeps.map(d => (
            <div key={d} className="fi-dep-row">
              <span className="fi-dep-name">{d}</span>
              <span className="fi-dep-ver">{PKG[d] || '—'}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="fi-files-section">
        <div className="fi-pkg-group-label">FILES TO GENERATE ({files.length})</div>
        <div className="fi-files-list">
          {files.map(f => (
            <span key={f} className="fi-file-tag">{f}</span>
          ))}
        </div>
      </div>

      <button
        className="btn primary"
        style={{ padding: '10px 22px', fontSize: 13 }}
        onClick={onGenerate}
        disabled={generating}
      >
        {generating
          ? <><Icon name="rev" size={14} /> Generating…</>
          : <><Icon name="download" size={14} /> Download {config.appName}.zip</>
        }
      </button>
      {!generating && (
        <div className="fi-gen-note">
          All files generated in your browser — no data sent to any server.
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────
export const FlutterInitPage = ({ onNav }) => {
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [generating, setGenerating] = useState(false);
  const [done, setDone] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await buildZip(config);
      setDone(true);
    } finally {
      setGenerating(false);
    }
  };

  const stepContent = [
    <StepInfo key="info" config={config} onChange={setConfig} />,
    <StepPlatform key="platform" config={config} onChange={setConfig} />,
    <StepState key="state" config={config} onChange={setConfig} />,
    <StepRouter key="router" config={config} onChange={setConfig} />,
    <StepBackend key="backend" config={config} onChange={setConfig} />,
    <StepPackages key="packages" config={config} onChange={setConfig} />,
    <StepArch key="arch" config={config} onChange={setConfig} />,
    <StepGenerate key="generate" config={config} onGenerate={handleGenerate} generating={generating} />,
  ];

  return (
    <div className="fi-page">
      <div className="page-head">
        <div>
          <div className="crumb">TOOLS / DEV TOOLKIT / FLUTTER INIT</div>
          <h1>Flutter Project Generator</h1>
          <div className="sub">Configure your stack and download a ready-to-run Flutter project</div>
        </div>
        <div className="actions">
          <button className="btn" onClick={() => onNav('toolkit')}>
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <Icon name="chev" size={12} />
            </span>
            Back to Toolkit
          </button>
        </div>
      </div>

      {/* Progress strip — spans full width between header and wizard */}
      <div className="fi-progress">
        <div className="fi-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="fi-layout">
        {/* ── Stepper sidebar ── */}
        <div className="fi-stepper">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={'fi-step' + (i === step ? ' active' : '') + (i < step ? ' done' : '')}
              onClick={() => setStep(i)}
            >
              <div className="fi-step-num">
                {i < step
                  ? <Icon name="check" size={11} />
                  : <span style={{ fontSize: 10, fontFamily: 'var(--f-mono)' }}>{i + 1}</span>
                }
              </div>
              <span className="fi-step-label">{s.label}</span>
            </button>
          ))}
        </div>

        {/* ── Step content ── */}
        <div className="fi-content">
          <div className="fi-content-head">
            <div className="fi-content-title">{STEPS[step].label}</div>
          </div>

          <div className="fi-content-body">
            {done && step === STEPS.length - 1 ? (
              <div className="fi-done">
                <div className="fi-done-icon">
                  <Icon name="check-circle" size={36} />
                </div>
                <div className="fi-done-title">{config.appName}.zip downloaded!</div>
                <div className="fi-done-sub">
                  Run <code>flutter pub get</code> inside the project folder, then <code>flutter run</code> to launch.
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button className="btn primary" onClick={handleGenerate} disabled={generating}>
                    <Icon name="download" size={12} /> Download again
                  </button>
                  <button className="btn" onClick={() => { setStep(0); setDone(false); setConfig(DEFAULT_CONFIG); }}>
                    <Icon name="rev" size={12} /> Start over
                  </button>
                </div>
              </div>
            ) : (
              stepContent[step]
            )}
          </div>

          <div className="fi-footer">
            <button
              className="btn"
              onClick={() => setStep(s => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
                <Icon name="chev" size={12} />
              </span>
              Back
            </button>
            <span className="fi-step-counter">Step {step + 1} of {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button className="btn primary" onClick={() => setStep(s => s + 1)}>
                Next <Icon name="chev" size={12} />
              </button>
            ) : (
              <button className="btn primary" onClick={handleGenerate} disabled={generating}>
                {generating ? 'Generating…' : <><Icon name="download" size={12} /> Generate ZIP</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
