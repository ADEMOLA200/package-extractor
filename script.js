document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & State ---
    const translations = {
        en: {
            title: "Package Extractor",
            description: "Extract textures and models from .unitypackage files directly in your browser.",
            "description-end": "",
            creator: "Created by ",
            repository: "Repository: ",
            dropZone: "Drag & Drop .unitypackage here",
            excludeMeta: "Exclude .meta files",
            categorizeByExtension: "Categorize by type",
            maintainStructure: "Keep folder structure",
            showFileSize: "Show file size",
            checkerboardBg: "Transparency grid",
            showPngGrid: "Gallery View",
            pngGridScale: "Thumbnail Size:",
            downloadAll: "Download All (ZIP)",
            downloadCategory: "Download {0} (ZIP)",
            errorMessage: "Error processing package.",
            invalidFile: "Please drop a .unitypackage file.",
            selectAll: "Select All",
            deselectAll: "Deselect All",
            selectedCount: "{0} Selected",
            downloadSelected: "Download Selected",
            clearSelection: "Clear",
            sortNameAsc: "Name (A-Z)",
            sortNameDesc: "Name (Z-A)",
            sortSizeAsc: "Size (Smallest)",
            sortSizeDesc: "Size (Largest)"
        },
        ja: {
            title: "開ける君",
            description: "ブラウザーから.unitypackageの中身（テクスチャやモデル）を抽出できます。",
            "description-end": "",
            creator: "作成者: ",
            repository: "リポジトリ: ",
            dropZone: ".unitypackageをここにドラッグ＆ドロップ",
            excludeMeta: ".metaを除外",
            categorizeByExtension: "拡張子ごとに分ける",
            maintainStructure: "フォルダ構造を維持",
            enablePreview: "プレビューを表示",
            showFileSize: "サイズを表示",
            checkerboardBg: "透過背景を表示",
            showPngGrid: "ギャラリー表示",
            pngGridScale: "サイズ:",
            downloadAll: "一括ダウンロード (ZIP)",
            downloadCategory: "{0}をダウンロード (ZIP)",
            errorMessage: "エラーが発生しました。",
            invalidFile: ".unitypackageファイルのみ対応しています。",
            selectAll: "すべて選択",
            deselectAll: "選択解除",
            selectedCount: "{0}個を選択中",
            downloadSelected: "選択したファイルを保存",
            clearSelection: "クリア",
            sortNameAsc: "名前順 (昇順)",
            sortNameDesc: "名前順 (降順)",
            sortSizeAsc: "サイズ順 (小さい順)",
            sortSizeDesc: "サイズ順 (大きい順)"
        },
        ko: {
            title: "Package Extractor",
            description: "브라우저에서 .unitypackage 파일의 텍스처와 모델을 추출할 수 있습니다.",
            "description-end": "",
            creator: "제작자: ",
            repository: "리포지토리: ",
            dropZone: ".unitypackage를 여기에 드롭",
            excludeMeta: ".meta 제외",
            categorizeByExtension: "확장자별 분류",
            maintainStructure: "폴더 구조 유지",
            enablePreview: "미리보기 활성화",
            showFileSize: "파일 크기 표시",
            checkerboardBg: "투명 배경 표시",
            showPngGrid: "갤러리 뷰",
            pngGridScale: "크기:",
            downloadAll: "전체 다운로드 (ZIP)",
            downloadCategory: "{0} 다운로드 (ZIP)",
            errorMessage: "오류가 발생했습니다.",
            invalidFile: ".unitypackage 파일만 지원합니다.",
            selectAll: "모두 선택",
            deselectAll: "선택 해제",
            selectedCount: "{0}개 선택됨",
            downloadSelected: "선택 항목 다운로드",
            clearSelection: "취소",
            sortNameAsc: "이름순 (A-Z)",
            sortNameDesc: "이름순 (Z-A)",
            sortSizeAsc: "크기순 (작은순)",
            sortSizeDesc: "크기순 (큰순)"
        }
    };

    let extractedFiles = {};
    let activeObjectUrls = [];
    let selectedPaths = new Set();

    // Drag & Shift Selection State
    let isDragging = false;
    let dragMode = true; // true = select, false = deselect
    let lastSelectedPath = null;

    // Window-level mouseup to stop dragging
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // --- DOM Elements ---
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const fileList = document.getElementById('fileList');
    const excludeMetaCheckbox = document.getElementById('excludeMeta');
    const categorizeByExtensionCheckbox = document.getElementById('categorizeByExtension');
    const maintainStructureCheckbox = document.getElementById('maintainStructure');
    // enablePreviewCheckbox removed
    const showFileSizeCheckbox = document.getElementById('showFileSize');
    const checkerboardBgCheckbox = document.getElementById('checkerboardBg');
    const showPngGridCheckbox = document.getElementById('showPngGrid');
    const pngGrid = document.getElementById('pngGrid');
    const pngGridControls = document.getElementById('pngGridControls');
    const pngGridScale = document.getElementById('pngGridScale');
    const sortOrderSelect = document.getElementById('sortOrder');
    const downloadAllBtn = document.getElementById('downloadAllBtn');

    // Selection Bar
    const selectionBar = document.getElementById('selectionBar');
    const selectionCount = document.getElementById('selectionCount');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');

    // Create 'Select All' button for Grid
    const gridSelectAllBtn = document.createElement('button');
    gridSelectAllBtn.id = 'gridSelectAllBtn';
    gridSelectAllBtn.className = 'grid-select-all';

    // --- Language ---
    let currentLanguage = navigator.language.split('-')[0];
    if (!translations[currentLanguage]) currentLanguage = 'en';

    function updateLanguage(lang) {
        document.querySelectorAll('[data-lang]').forEach(el => {
            const key = el.getAttribute('data-lang');
            if (translations[lang][key]) {
                el.textContent = translations[lang][key];
            }
        });
        gridSelectAllBtn.textContent = translations[lang].selectAll;
        if (selectionBar.classList.contains('visible')) updateSelectionUI();
    }
    updateLanguage(currentLanguage);

    // --- Core Logic ---
    class UnityExtractClient {
        constructor() { }

        async extract(arrayBuffer) {
            if (typeof fflate === 'undefined') throw new Error("fflate missing");
            const unzipped = fflate.gunzipSync(new Uint8Array(arrayBuffer));
            return this.parseTarball(unzipped);
        }

        parseTarball(data) {
            const files = {};
            let offset = 0;
            while (offset < data.length) {
                const header = data.slice(offset, offset + 512);
                if (header.length < 512) break;

                const nameBuffer = header.slice(0, 100);
                const name = new TextDecoder().decode(nameBuffer).replace(/\0/g, '').trim();
                const sizeBuffer = header.slice(124, 136);
                const size = parseInt(new TextDecoder().decode(sizeBuffer).trim(), 8);

                if (isNaN(size)) break;
                if (size > 0) files[name] = data.slice(offset + 512, offset + 512 + size);
                offset += 512 + Math.ceil(size / 512) * 512;
            }
            return this.convert(files);
        }

        convert(files) {
            const convertedFiles = {};
            const directories = Object.keys(files).filter(f => f.endsWith('/pathname'));
            for (const dir of directories) {
                const basePath = dir.replace('/pathname', '');
                const pathContent = new TextDecoder().decode(files[dir]);
                const newPath = pathContent.split('\n')[0].trim();
                if (!newPath) continue;

                const assetPath = `${basePath}/asset`;
                const metaPath1 = `${basePath}/asset.meta`;
                const metaPath2 = `${basePath}/metaData`; // Fallback

                if (files[assetPath]) convertedFiles[newPath] = files[assetPath];
                if (files[metaPath1]) convertedFiles[`${newPath}.meta`] = files[metaPath1];
                else if (files[metaPath2]) convertedFiles[`${newPath}.meta`] = files[metaPath2];
            }
            return convertedFiles;
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    const extractor = new UnityExtractClient();

    // --- Event Handlers ---
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); });
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.unitypackage')) {
            await processUnityPackage(files[0]);
        } else {
            alert(translations[currentLanguage].invalidFile);
        }
    });
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) await processUnityPackage(e.target.files[0]);
    });

    [excludeMetaCheckbox, categorizeByExtensionCheckbox, maintainStructureCheckbox, showFileSizeCheckbox, showPngGridCheckbox, checkerboardBgCheckbox].forEach(cb => {
        cb.addEventListener('change', () => displayExtractedFiles(extractedFiles));
    });

    pngGridScale.addEventListener('input', (e) => {
        const scaleVal = parseInt(e.target.value, 10) || 30;
        // Map 0-100 to roughly 80px - 250px
        const minSize = 80;
        const maxSize = 250;
        const itemSize = minSize + (scaleVal / 100) * (maxSize - minSize);

        // Update CSS variable only - almost zero cost
        pngGrid.style.setProperty('--grid-item-size', `${Math.floor(itemSize)}px`);
    });

    sortOrderSelect.addEventListener('change', () => {
        // Trigger re-render to apply new sort order
        displayExtractedFiles(extractedFiles);
    });

    downloadAllBtn.addEventListener('click', downloadAll);
    downloadSelectedBtn.addEventListener('click', downloadSelected);
    clearSelectionBtn.addEventListener('click', clearSelection);

    gridSelectAllBtn.addEventListener('click', () => {
        const gridItems = document.querySelectorAll('.png-node');
        const allSelected = Array.from(gridItems).every(item => item.classList.contains('selected'));
        gridItems.forEach(item => {
            const path = item.dataset.path;
            allSelected ? selectedPaths.delete(path) : selectedPaths.add(path);
        });
        updateSelectionUI();
        displayExtractedFiles(extractedFiles);
    });

    // --- Processing ---
    async function processUnityPackage(file) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            extractedFiles = await extractor.extract(arrayBuffer);
            selectedPaths.clear();
            updateSelectionUI();

            // Force select the Grid View for PNGs by default if not set
            // showPngGridCheckbox.checked = true; // User preference? Let's check it by default in HTML actually.

            displayExtractedFiles(extractedFiles);
            downloadAllBtn.style.display = 'block';
        } catch (error) {
            console.error(error);
            alert(translations[currentLanguage].errorMessage);
        }
    }

    function toggleFileSelection(path, forceState = null) {
        let isSelected = selectedPaths.has(path);

        // Determine new state
        const newState = forceState !== null ? forceState : !isSelected;

        if (newState) {
            selectedPaths.add(path);
        } else {
            selectedPaths.delete(path);
        }

        // Update specific node UI immediately for better performance during drag
        const node = document.querySelector(`.png-node[data-path="${CSS.escape(path)}"]`);
        if (node) {
            node.classList.toggle('selected', newState);
        }

        updateSelectionUI(false); // Pass false to skip full DOM sync if optimizing
    }

    function updateSelectionUI(syncGrid = true) {
        const count = selectedPaths.size;
        selectionCount.textContent = translations[currentLanguage].selectedCount.replace('{0}', count);
        selectionBar.classList.toggle('visible', count > 0);

        // Sync Checkboxes
        document.querySelectorAll('input.file-checkbox').forEach(cb => {
            cb.checked = selectedPaths.has(cb.dataset.path);
        });

        // Sync Grid Items (only if requested, to avoid double-work during internal updates)
        if (syncGrid) {
            document.querySelectorAll('.png-node').forEach(node => {
                node.classList.toggle('selected', selectedPaths.has(node.dataset.path));
            });
        }
    }

    function clearSelection() {
        selectedPaths.clear();
        updateSelectionUI();
    }

    function displayExtractedFiles(files) {
        fileList.innerHTML = '';
        pngGrid.innerHTML = '';

        if (!files || Object.keys(files).length === 0) return;

        const categorizedFiles = {};
        for (const [path, content] of Object.entries(files)) {
            if (excludeMetaCheckbox.checked && path.endsWith('.meta')) continue;
            const extension = path.split('.').pop().toLowerCase();
            if (!categorizedFiles[extension]) categorizedFiles[extension] = [];
            categorizedFiles[extension].push({ path, content });
        }

        // --- Gallery View (Grid) for images ---
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp'];
        const hasImages = imageExtensions.some(ext => categorizedFiles[ext] && categorizedFiles[ext].length > 0);

        if (showPngGridCheckbox.checked && hasImages) {
            updatePngGrid(categorizedFiles);
        }

        // --- List View for everything else (or PNGs if grid disabled) ---
        if (categorizeByExtensionCheckbox.checked) {
            for (const [extension, catFiles] of Object.entries(categorizedFiles)) {
                if (imageExtensions.includes(extension) && showPngGridCheckbox.checked) continue; // Skip images in list if grid is on

                const category = document.createElement('div');
                category.className = 'category';

                const h3 = document.createElement('h3');
                h3.textContent = extension.toUpperCase();

                // Select All Button for Category
                const catSelectBtn = document.createElement('button');
                catSelectBtn.textContent = translations[currentLanguage].selectAll;
                catSelectBtn.style.fontSize = '0.7em';
                catSelectBtn.addEventListener('click', () => {
                    catFiles.forEach(f => selectedPaths.add(f.path));
                    updateSelectionUI();
                });

                // Download Category Button
                const dlBtn = document.createElement('button');
                dlBtn.textContent = '↓'; // Compact download icon
                dlBtn.title = translations[currentLanguage].downloadCategory.replace('{0}', extension.toUpperCase());
                dlBtn.addEventListener('click', () => downloadCategory(extension, catFiles));

                const actionsDiv = document.createElement('div');
                actionsDiv.style.display = 'flex';
                actionsDiv.style.gap = '10px';
                actionsDiv.appendChild(catSelectBtn);
                actionsDiv.appendChild(dlBtn);

                h3.appendChild(actionsDiv);
                category.appendChild(h3);

                const ul = document.createElement('ul');
                catFiles.forEach(file => {
                    ul.appendChild(createFileListItem(file.path, file.content));
                });
                category.appendChild(ul);
                fileList.appendChild(category);
            }
        } else {
            // Flat list
            const ul = document.createElement('ul');
            Object.values(categorizedFiles).flat().forEach(file => {
                if (showPngGridCheckbox.checked && isImageFile(file.path)) return;
                ul.appendChild(createFileListItem(file.path, file.content));
            });
            fileList.appendChild(ul);
        }

        updateLanguage(currentLanguage);
    }

    function createFileListItem(path, content) {
        const li = document.createElement('li');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'file-checkbox';
        checkbox.dataset.path = path;
        checkbox.checked = selectedPaths.has(path);
        checkbox.addEventListener('change', () => toggleFileSelection(path));

        const a = document.createElement('a');
        const blob = new Blob([content], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        a.href = url;
        a.textContent = maintainStructureCheckbox.checked ? path : path.split('/').pop();
        a.download = a.textContent;

        li.appendChild(checkbox);
        li.appendChild(a);


        return li;
    }

    function isImageFile(path) {
        return ['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(path.split('.').pop().toLowerCase());
    }

    function updatePngGrid(categorizedFiles) {
        // Cleanup previous URLs to prevent memory leaks
        if (activeObjectUrls.length > 0) {
            activeObjectUrls.forEach(url => URL.revokeObjectURL(url));
            activeObjectUrls = [];
        }

        const imageFiles = [];
        ['png', 'jpg', 'jpeg', 'gif', 'bmp'].forEach(ext => {
            if (categorizedFiles[ext]) {
                imageFiles.push(...categorizedFiles[ext]);
            }
        });

        if (imageFiles.length === 0) {
            pngGrid.style.display = 'none';
            pngGridControls.style.display = 'none';
            return;
        }

        // Sort Files
        const sortOrder = sortOrderSelect.value;
        imageFiles.sort((a, b) => {
            const pathA = a.path.split('/').pop().toLowerCase();
            const pathB = b.path.split('/').pop().toLowerCase();
            const sizeA = a.content.length;
            const sizeB = b.content.length;

            switch (sortOrder) {
                case 'name_desc': return pathB.localeCompare(pathA);
                case 'size_asc': return sizeA - sizeB;
                case 'size_desc': return sizeB - sizeA;
                case 'name_asc': default: return pathA.localeCompare(pathB);
            }
        });

        pngGrid.innerHTML = '';
        pngGrid.style.display = 'grid';
        pngGridControls.style.display = 'flex'; // Enable controls

        // Append 'Select All' if missing
        if (!pngGridControls.contains(gridSelectAllBtn)) {
            pngGridControls.prepend(gridSelectAllBtn);
        }

        // Initialize size based on current slider value
        const scaleVal = parseInt(pngGridScale.value, 10) || 30;
        const minSize = 80;
        const maxSize = 250;
        const itemSize = minSize + (scaleVal / 100) * (maxSize - minSize);
        pngGrid.style.setProperty('--grid-item-size', `${Math.floor(itemSize)}px`);

        imageFiles.forEach(file => {
            const ext = file.path.split('.').pop().toLowerCase();
            let mimeType = `image/${ext}`;
            if (ext === 'jpg') mimeType = 'image/jpeg';

            const blob = new Blob([file.content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            activeObjectUrls.push(url); // Track for cleanup

            const node = document.createElement('div');
            node.className = 'png-node';
            // Checkerboard class moved to wrapper
            node.dataset.path = file.path;

            if (selectedPaths.has(file.path)) node.classList.add('selected');

            // Wrapper for Image and Indicator
            const wrapper = document.createElement('div');
            wrapper.className = 'png-preview-wrapper';
            if (checkerboardBgCheckbox.checked) wrapper.classList.add('checkerboard-bg');

            // Image
            const img = document.createElement('img');
            img.src = url;
            img.loading = 'lazy'; // Performance

            // Selection Indicator Overlay
            const indicator = document.createElement('div');
            indicator.className = 'selection-indicator';

            wrapper.appendChild(img);
            wrapper.appendChild(indicator);

            // Filename Label
            const label = document.createElement('div');
            label.className = 'png-label';
            label.textContent = file.path.split('/').pop();
            label.title = file.path; // Tooltip for full path

            node.appendChild(label);
            node.appendChild(wrapper);

            // File Size & Type Info
            const info = document.createElement('div');
            info.className = 'png-info';
            info.textContent = formatFileSize(file.content.length);
            node.appendChild(info);

            // Click behavior: Shift, Drag, Click
            node.addEventListener('mousedown', (e) => {
                if (e.shiftKey) return; // Let click handler handle shift
                if (e.which !== 1) return; // Only Left Click

                e.preventDefault(); // Prevent text selection
                isDragging = true;

                // If the item is already selected, we might be starting a "deselect" drag.
                // However, standard behavior for unselected item is "select".
                // If item IS selected, user might want to drag-deselect OR just click to deselect.
                // Simple logic: Toggle the current one, and use THAT new state as the drag target.
                const currentState = selectedPaths.has(file.path);
                dragMode = !currentState;

                toggleFileSelection(file.path, dragMode);
                lastSelectedPath = file.path;
            });

            // Prevent native drag from interfering with our drag selection
            node.addEventListener('dragstart', (e) => {
                e.preventDefault();
            });

            node.addEventListener('mouseenter', (e) => {
                if (isDragging) {
                    toggleFileSelection(file.path, dragMode);
                    lastSelectedPath = file.path;
                }
            });

            node.addEventListener('click', (e) => {
                if (e.shiftKey && lastSelectedPath) {
                    // Range Selection
                    const allNodes = Array.from(document.querySelectorAll('.png-node'));
                    const startIdx = allNodes.findIndex(n => n.dataset.path === lastSelectedPath);
                    const endIdx = allNodes.findIndex(n => n.dataset.path === file.path);

                    if (startIdx !== -1 && endIdx !== -1) {
                        const [min, max] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
                        // Determine whether to select or deselect based on the target logic?
                        // Usually Shift+Click adds to selection (or sets selection).
                        // Let's assume Add to selection for simplicity, or match the last operation?
                        // Standard: Select everything in range.
                        for (let i = min; i <= max; i++) {
                            const path = allNodes[i].dataset.path;
                            selectedPaths.add(path);
                        }
                        updateSelectionUI();
                    }
                } else {
                    // Normal click is handled by mousedown for responsiveness, 
                    // BUT we need to update lastSelectedPath here too if mousedown didn't fire (weird case)
                    // or just ensure Shift logic has a base.
                    if (!e.shiftKey) {
                        // Mousedown already handled the toggle. Just update last path.
                        lastSelectedPath = file.path;
                    }
                }
            });

            pngGrid.appendChild(node);
        });
    }

    // --- Downloads ---
    async function downloadCategory(extension, files) {
        const zipObj = {};
        files.forEach(file => {
            const name = maintainStructureCheckbox.checked ? file.path : file.path.split('/').pop();
            zipObj[name] = file.content;
        });
        downloadZip(zipObj, `${extension}_files.zip`);
    }

    async function downloadAll() {
        const zipObj = {};
        for (const [path, content] of Object.entries(extractedFiles)) {
            if (excludeMetaCheckbox.checked && path.endsWith('.meta')) continue;
            const name = maintainStructureCheckbox.checked ? path : path.split('/').pop();
            zipObj[name] = content;
        }
        downloadZip(zipObj, 'all_files.zip');
    }

    async function downloadSelected() {
        if (selectedPaths.size === 0) return;
        const zipObj = {};
        for (const [path, content] of Object.entries(extractedFiles)) {
            if (selectedPaths.has(path)) {
                const name = maintainStructureCheckbox.checked ? path : path.split('/').pop();
                zipObj[name] = content;
            }
        }
        downloadZip(zipObj, 'selected_files.zip');
    }

    function downloadZip(filesObj, filename) {
        if (typeof fflate === 'undefined') return alert('Error: Library missing');
        const content = new Blob([fflate.zipSync(filesObj)]);
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = filename;
        link.click();
    }
});
