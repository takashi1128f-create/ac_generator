// ==========================================
// Assetto Corsa (acs.exe) Decompiled Reference
// ==========================================

// 1. CarAvatar::init3D (view.ini オーバーライドと全ミラーマスターカメラの証拠)
void __thiscall CarAvatar::init3D(CarAvatar *this, basic_string<> *param_1) {
    // ... 中略 ...
    pbVar5 = Path::getDocumentPath((basic_string<> *)local_1d0);
    pbVar5 = std::operator+<>(&local_290,pbVar5,L"/Assetto Corsa/cfg/cars/");
    pbVar5 = std::operator+<>(&local_270,pbVar5,&this->unixName);
    pbVar5 = std::operator+<>(&local_230,pbVar5,L"/view.ini");
    bVar11 = Path::fileExists(pbVar5,false);
    
    // 【仕様1】view.ini が存在する場合は最優先で読み込み、DRIVEREYESを上書き
    if (bVar11) {
        INIReaderDocuments::INIReaderDocuments((INIReaderDocuments *)&local_138,pbVar5,false);
        if (local_138.ready != false) {
            std::basic_string<>::assign(&local_290,L"DRIVER_EYES_POSITION",0x14);
            pvVar6 = INIReader::getFloat3(&local_138,(vec3f *)local_2b8,&local_290,&local_270);
            (this->driverEyesPosition).x = pvVar6->x;
            (this->driverEyesPosition).y = pvVar6->y; 
            (this->driverEyesPosition).z = pvVar6->z;
        }
    }
    
    // 【仕様2】全ミラー（ドア/ルーム/バーチャル）共通の後方撮影用カメラの座標設定
    // car.iniから読んだMIRROR_POSITIONの「X(左右)」だけを残し、「Y(高さ)」と「Z(前後)」をドライバー目線に強制同期
    (this->mirrorPosition).y = (this->driverEyesPosition).y;
    (this->mirrorPosition).z = (this->driverEyesPosition).z;
    
    // ...
}

// 2. FormCamera::savecameraF1 (ダッシュボード視点とラジアン変換の証拠)
void __thiscall FormCamera::savecameraF1(FormCamera *this) {
    if (this->currentCamera == 5) {
        // currentCamera == 5 はダッシュボード視点 (dash_cam.ini を処理)
        std::operator+<>(&local_2f0,pbVar6,L"/data/dash_cam.ini");
        WritePrivateProfileStringW(L"DASH_CAM",L"EXP", ...);
        return;
    }
    // EXPOSURE保存
    WritePrivateProfileStringW(L"GRAPHICS",L"ONBOARD_EXPOSURE", ...);
    
    if (this->currentCamera == 0) {
        // currentCamera == 0 はコックピット視点
        // ラジアン * 57.29578 で度数法(Degree)に変換
        pbVar6 = std::to_wstring(&local_1f0, **(float **)&this->sim->cameraManager->cameraOnBoard->customCameraSettings * 57.29578);
        WritePrivateProfileStringW(L"GRAPHICS",L"ON_BOARD_PITCH_ANGLE", ...);
    }
    else if (this->currentCamera == 3) {
        // currentCamera == 3 はボンネット視点
        WritePrivateProfileStringW(L"GRAPHICS",L"BONNET_CAMERA_PITCH", ...);
    }
}

// 3. FormCamera::selectCamera (F1キーとF6キーの役割分担の証拠)
void __thiscall FormCamera::selectCamera(FormCamera *this, CameraMode param_1, int param_2) {
    this->currentMode = param_1;
    ACCameraManager::setMode(this->sim->cameraManager,param_1,false,false);
    
    // F1グループ (コックピット・ボンネット・バンパー)
    if (this->currentMode == eCockpit) {
        savecameraF1(this);
        ACCameraManager::setDrivableCarIndex(this->sim->cameraManager,param_2);
        this->currentCamera = param_2;
        pCVar2 = this->cameraF1[param_2];
        (pCVar2->backColor).x = 1.0; // ボタン色を赤に
    }
    // F6グループ (車外固定カメラ)
    if (this->currentMode == eCar) {
        savecameraF6(this);
        ACCameraManager::setCameraCarIndex(this->sim->cameraManager,param_2);
        this->currentCamera = param_2;
        pCVar2 = this->cameraF6[param_2];
        (pCVar2->backColor).x = 1.0; // ボタン色を赤に
    }
}

// 4. ACCameraManager::setDrivableCarIndex (カメラ切り替えのコアロジック)
void __thiscall ACCameraManager::setDrivableCarIndex(ACCameraManager *this,int param_1) {
    CameraMode CVar2;
    CVar2 = -(uint)(param_1 != 0) & eDrivable;
    this->mode = CVar2; // メモリオフセット 0x120 への書き込み
    
    if (CVar2 == eCockpit) {
        this->currentGlobalCameraIndex = 0;
    }
    else if (CVar2 == eDrivable) {
        this->cameraDrivable->currentMode = param_1 - eChase2; // ボンネット/バンパーの切替
        this->currentGlobalCameraIndex = param_1;
    }
}