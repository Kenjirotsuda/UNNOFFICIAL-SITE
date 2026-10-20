        const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
        const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=600&q=80';

        // Global Application Cache & State
        let mangaCache = {}; // Map media.id -> media object
        let state = {
            currentNav: 'discover',
            formatFilter: 'MANGA',
            searchQuery: '',
            activeMangaId: null,
            libraryTab: 'reading',
            reader: {
                mangaId: null,
                chapter: 1,
                mode: 'vertical',
                theme: 'dark',
                currentPage: 1,
                totalPages: 5
            },
            userData: JSON.parse(localStorage.getItem('manga_pulse_anilist_user')) || {}
        };

        function saveUserData() {
            localStorage.setItem('manga_pulse_anilist_user', JSON.stringify(state.userData));
            updateLibraryBadges();
        }

        window.addEventListener('DOMContentLoaded', () => {
            fetchMangaData();
            updateLibraryBadges();
        });

        // NAVIGATION LOGIC
        function switchNav(nav) {
            state.currentNav = nav;
            const discoverView = document.getElementById('view-discover');
            const libraryView = document.getElementById('view-library');
            const btnDiscover = document.getElementById('nav-discover');
            const btnLibrary = document.getElementById('nav-library');

            if (nav === 'discover') {
                discoverView.classList.remove('hidden');
                libraryView.classList.add('hidden');
                btnDiscover.className = "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 transition-all shadow-md shadow-blue-600/20";
                btnLibrary.className = "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all";
            } else {
                discoverView.classList.add('hidden');
                libraryView.classList.remove('hidden');
                btnLibrary.className = "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-blue-600 transition-all shadow-md shadow-blue-600/20";
                btnDiscover.className = "flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all";
                renderLibraryGrid();
            }
        }

        // ANILIST GRAPHQL QUERY FETCH
        async function fetchMangaData() {
            const grid = document.getElementById('manga-grid');
            const loading = document.getElementById('loading-state');
            const noResults = document.getElementById('no-results');

            loading.classList.remove('hidden');
            grid.innerHTML = '';
            noResults.classList.add('hidden');

            const genre = document.getElementById('genre-select').value;
            const sort = document.getElementById('sort-select').value;
            
            // Build GraphQL query payload
            const query = `
                query ($search: String, $sort: [MediaSort], $format: MediaFormat, $genre: String) {
                    Page (perPage: 30) {
                        media (type: MANGA, search: $search, sort: $sort, format: $format, genre: $genre) {
                            id
                            title {
                                romaji
                                english
                            }
                            coverImage {
                                large
                                extraLarge
                            }
                            bannerImage
                            description
                            chapters
                            averageScore
                            favourites
                            status
                            format
                            genres
                            staff {
                                nodes {
                                    name {
                                        full
                                    }
                                }
                            }
                        }
                    }
                }
            `;

            const variables = {
                sort: [sort],
                format: state.formatFilter
            };

            if (state.searchQuery) {
                variables.search = state.searchQuery;
            }
            if (genre) {
                variables.genre = genre;
            }

            try {
                const response = await fetch(ANILIST_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    },
                    body: JSON.stringify({ query, variables })
                });

                const json = await response.json();
                loading.classList.add('hidden');

                if (json.errors || !json.data || !json.data.Page) {
                    noResults.classList.remove('hidden');
                    return;
                }

                const mediaList = json.data.Page.media;
                
                // Cache items globally for modal and library use
                mediaList.forEach(m => { mangaCache[m.id] = m; });

                if (mediaList.length === 0) {
                    noResults.classList.remove('hidden');
                    return;
                }

                renderDiscoverGrid(mediaList);

            } catch (err) {
                console.error('Error fetching from AniList API:', err);
                loading.classList.add('hidden');
                noResults.classList.remove('hidden');
            }
        }

        function setFormatFilter(fmt) {
            state.formatFilter = fmt;
            ['MANGA', 'NOVEL', 'ONE_SHOT'].forEach(f => {
                const el = document.getElementById(`filter-fmt-${f.toLowerCase().replace('_','')}`);
                if (f === fmt) {
                    el.className = "px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white whitespace-nowrap transition-all";
                } else {
                    el.className = "px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all";
                }
            });
            fetchMangaData();
        }

        let searchTimeout = null;
        function handleSearchInput(val) {
            clearTimeout(searchTimeout);
            state.searchQuery = val.trim();
            searchTimeout = setTimeout(() => {
                fetchMangaData();
            }, 400); // Debounce API calls
        }

        function renderDiscoverGrid(list) {
            const grid = document.getElementById('manga-grid');
            
            grid.innerHTML = list.map(manga => {
                const title = manga.title.english || manga.title.romaji || 'Untitled';
                const score = manga.averageScore ? (manga.averageScore / 10).toFixed(1) : 'N/A';
                const chapters = manga.chapters || '??';
                const cover = manga.coverImage.extraLarge || manga.coverImage.large || FALLBACK_IMAGE;
                const userEntry = state.userData[manga.id] || {};
                const isFav = userEntry.isFavorite;

                return `
                    <div onclick="openSeriesModal(${manga.id})" class="group cursor-pointer bg-slate-900/65 rounded-xl overflow-hidden border border-slate-800/80 hover:border-slate-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/50 flex flex-col">
                        <div class="relative aspect-[3/4] overflow-hidden bg-slate-800">
                            <img src="${cover}" alt="${title}" onerror="this.src='${FALLBACK_IMAGE}'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                            <div class="absolute inset-0 manga-card-gradient"></div>
                            
                            <div class="absolute top-2 left-2">
                                <span class="px-2 py-0.5 text-[10px] font-extrabold tracking-wider rounded bg-black/60 backdrop-blur-md text-white border border-white/10 uppercase">${manga.format}</span>
                            </div>

                            ${isFav ? `<div class="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-500/80 backdrop-blur-md text-white flex items-center justify-center text-xs"><i class="fa-solid fa-heart"></i></div>` : ''}

                            <div class="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs font-semibold text-slate-300">
                                <span class="flex items-center gap-1 text-amber-400"><i class="fa-solid fa-star text-[10px]"></i> ${score}</span>
                                <span>Ch. ${chapters}</span>
                            </div>
                        </div>

                        <div class="p-3 flex flex-col flex-grow justify-between">
                            <div>
                                <h3 class="font-bold text-sm text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">${title}</h3>
                                <p class="text-[11px] text-slate-500 line-clamp-1 mt-0.5">${manga.genres.slice(0, 2).join(', ')}</p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // MODAL DETAILED VIEW
        function openSeriesModal(id) {
            state.activeMangaId = id;
            const manga = mangaCache[id];
            if (!manga) return;

            const userEntry = state.userData[id] || {};
            const title = manga.title.english || manga.title.romaji;
            const score = manga.averageScore ? (manga.averageScore / 10).toFixed(1) : 'N/A';
            const totalCh = manga.chapters || 50;

            document.getElementById('modal-banner').src = manga.bannerImage || manga.coverImage.extraLarge || FALLBACK_IMAGE;
            document.getElementById('modal-cover').src = manga.coverImage.extraLarge || manga.coverImage.large || FALLBACK_IMAGE;
            document.getElementById('modal-title').textContent = title;
            document.getElementById('modal-format').textContent = manga.format;
            document.getElementById('modal-status').textContent = manga.status || 'RELEASING';
            document.getElementById('modal-rating').textContent = score;
            document.getElementById('modal-chapters-info').textContent = `Total Chapters: ${manga.chapters || 'Unknown'}`;
            document.getElementById('modal-chapter-count').textContent = totalCh;
            document.getElementById('modal-synopsis').innerHTML = manga.description || 'No synopsis provided.';

            document.getElementById('modal-genres').innerHTML = manga.genres.map(g => `
                <span class="px-2 py-0.5 text-xs rounded-md bg-slate-800 text-slate-300 font-medium">${g}</span>
            `).join('');

            document.getElementById('modal-status-select').value = userEntry.status || 'none';

            const favBtn = document.getElementById('modal-fav-btn');
            if (userEntry.isFavorite) {
                favBtn.className = "px-3 py-2 rounded-lg bg-rose-500/20 border border-rose-500/30 text-xs text-rose-400 font-semibold transition-all flex items-center gap-1.5";
                favBtn.innerHTML = `<i class="fa-solid fa-heart"></i> Favorited`;
            } else {
                favBtn.className = "px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-rose-400 transition-all flex items-center gap-1.5";
                favBtn.innerHTML = `<i class="fa-regular fa-heart"></i> Favorite`;
            }

            // Render Chapter List preview
            const chapterList = document.getElementById('modal-chapter-list');
            let chaptersHtml = '';
            for (let i = totalCh; i >= 1; i--) {
                const isRead = userEntry.currentChapter && i <= userEntry.currentChapter;
                chaptersHtml += `
                    <div onclick="openReader(${manga.id}, ${i})" class="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-slate-800/60 cursor-pointer transition-all">
                        <span class="text-xs font-semibold ${isRead ? 'text-slate-400' : 'text-slate-200'}">Chapter ${i}</span>
                        <div class="flex items-center gap-2">
                            ${isRead ? `<span class="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">READ</span>` : ''}
                            <i class="fa-solid fa-chevron-right text-xs text-slate-600"></i>
                        </div>
                    </div>
                `;
            }
            chapterList.innerHTML = chaptersHtml;
            document.getElementById('details-modal').classList.remove('hidden');
        }

        function closeDetailsModal() {
            document.getElementById('details-modal').classList.add('hidden');
            state.activeMangaId = null;
        }

        function updateUserStatus(status) {
            const id = state.activeMangaId;
            if (!id) return;

            if (status === 'none') {
                delete state.userData[id];
            } else {
                if (!state.userData[id]) {
                    state.userData[id] = { status, isFavorite: false, currentChapter: 1 };
                } else {
                    state.userData[id].status = status;
                }
            }
            saveUserData();
            if (state.currentNav === 'library') renderLibraryGrid();
        }

        function toggleFavorite() {
            const id = state.activeMangaId;
            if (!id) return;

            if (!state.userData[id]) {
                state.userData[id] = { status: 'reading', isFavorite: true, currentChapter: 1 };
            } else {
                state.userData[id].isFavorite = !state.userData[id].isFavorite;
            }
            saveUserData();
            openSeriesModal(id);
        }

        // LIBRARY MANAGEMENT
        function switchLibraryTab(tab) {
            state.libraryTab = tab;
            ['reading', 'favorites', 'plan', 'completed'].forEach(t => {
                const btn = document.getElementById(`tab-${t}`);
                if (t === tab) {
                    btn.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white whitespace-nowrap transition-all";
                } else {
                    btn.className = "px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap transition-all";
                }
            });
            renderLibraryGrid();
        }

        function updateLibraryBadges() {
            let readingCount = 0, favCount = 0, planCount = 0, compCount = 0;
            Object.values(state.userData).forEach(item => {
                if (item.status === 'reading') readingCount++;
                if (item.status === 'plan') planCount++;
                if (item.status === 'completed') compCount++;
                if (item.isFavorite) favCount++;
            });

            document.getElementById('library-count-badge').textContent = readingCount + planCount + compCount;
            document.getElementById('mob-library-count').textContent = readingCount + planCount + compCount;
            document.getElementById('count-reading').textContent = readingCount;
            document.getElementById('count-favorites').textContent = favCount;
            document.getElementById('count-plan').textContent = planCount;
            document.getElementById('count-completed').textContent = compCount;
        }

        function renderLibraryGrid() {
            const grid = document.getElementById('library-grid');
            const emptyState = document.getElementById('empty-library');

            let savedIds = Object.keys(state.userData).filter(id => {
                const u = state.userData[id];
                if (state.libraryTab === 'favorites') return u.isFavorite;
                return u.status === state.libraryTab;
            });

            if (savedIds.length === 0) {
                grid.innerHTML = '';
                emptyState.classList.remove('hidden');
                return;
            }

            emptyState.classList.add('hidden');
            grid.innerHTML = savedIds.map(id => {
                const manga = mangaCache[id];
                if (!manga) return '';
                const u = state.userData[id];
                const title = manga.title.english || manga.title.romaji;
                const cover = manga.coverImage.large || FALLBACK_IMAGE;
                const totalCh = manga.chapters || 50;
                const curCh = u.currentChapter || 1;
                const progressPct = Math.min(100, Math.round((curCh / totalCh) * 100));

                return `
                    <div class="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex gap-3.5 items-center hover:border-slate-700 transition-all">
                        <img src="${cover}" alt="${title}" onerror="this.src='${FALLBACK_IMAGE}'" class="w-16 h-24 object-cover rounded-lg shrink-0 cursor-pointer" onclick="openSeriesModal(${manga.id})">
                        
                        <div class="flex-grow min-w-0 space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-bold uppercase text-blue-400 tracking-wider">${manga.format}</span>
                                <button onclick="toggleFavoriteId(${manga.id})" class="text-xs ${u.isFavorite ? 'text-rose-500' : 'text-slate-600 hover:text-slate-400'}"><i class="fa-solid fa-heart"></i></button>
                            </div>
                            
                            <h4 class="font-bold text-sm text-slate-100 truncate cursor-pointer hover:text-blue-400" onclick="openSeriesModal(${manga.id})">${title}</h4>
                            
                            <div class="space-y-1">
                                <div class="flex justify-between text-[11px] text-slate-400">
                                    <span>Ch. ${curCh} / ${totalCh}</span>
                                    <span>${progressPct}%</span>
                                </div>
                                <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div class="bg-blue-500 h-full rounded-full transition-all duration-300" style="width: ${progressPct}%"></div>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 pt-1">
                                <button onclick="updateChapterProgress(${manga.id}, -1)" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs">-</button>
                                <button onclick="updateChapterProgress(${manga.id}, 1)" class="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center text-xs">+</button>
                                <button onclick="openReader(${manga.id}, ${curCh})" class="ml-auto px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-md flex items-center gap-1">
                                    <i class="fa-solid fa-book-open text-[10px]"></i> Read
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        function updateChapterProgress(mangaId, delta) {
            if (!state.userData[mangaId]) return;
            const manga = mangaCache[mangaId];
            const maxCh = manga.chapters || 100;
            let nextCh = (state.userData[mangaId].currentChapter || 1) + delta;
            nextCh = Math.max(1, Math.min(maxCh, nextCh));
            
            state.userData[mangaId].currentChapter = nextCh;
            saveUserData();
            renderLibraryGrid();
        }

        function toggleFavoriteId(mangaId) {
            if (!state.userData[mangaId]) return;
            state.userData[mangaId].isFavorite = !state.userData[mangaId].isFavorite;
            saveUserData();
            renderLibraryGrid();
        }

        // READER SYSTEM
        function openReader(mangaId, chapter) {
            closeDetailsModal();
            state.reader.mangaId = mangaId;
            state.reader.chapter = chapter;
            state.reader.currentPage = 1;

            const manga = mangaCache[mangaId];
            const title = manga.title.english || manga.title.romaji;
            const totalCh = manga.chapters || 50;

            if (!state.userData[mangaId]) {
                state.userData[mangaId] = { status: 'reading', isFavorite: false, currentChapter: chapter };
            } else {
                state.userData[mangaId].currentChapter = Math.max(state.userData[mangaId].currentChapter || 1, chapter);
            }
            saveUserData();

            document.getElementById('reader-title').textContent = title;
            document.getElementById('reader-chapter-name').textContent = `Chapter ${chapter}`;

            const select = document.getElementById('reader-chapter-select');
            let opts = '';
            for (let i = 1; i <= totalCh; i++) {
                opts += `<option value="${i}" ${i === chapter ? 'selected' : ''}>Ch. ${i}</option>`;
            }
            select.innerHTML = opts;

            renderReaderPages();
            document.getElementById('reader-modal').classList.remove('hidden');
        }

        function closeReader() {
            document.getElementById('reader-modal').classList.add('hidden');
        }

        function switchReaderChapter(ch) {
            openReader(state.reader.mangaId, parseInt(ch));
        }

        function toggleReaderMode() {
            state.reader.mode = state.reader.mode === 'vertical' ? 'horizontal' : 'vertical';
            document.getElementById('reader-mode-label').textContent = state.reader.mode === 'vertical' ? 'Webtoon Scroll' : 'Page Flip';
            document.getElementById('reader-layout-btn').querySelector('i').className = state.reader.mode === 'vertical' ? 'fa-solid fa-arrows-up-down' : 'fa-solid fa-arrows-left-right';
            renderReaderPages();
        }

        function cycleReaderTheme() {
            const viewport = document.getElementById('reader-viewport');
            if (state.reader.theme === 'dark') {
                state.reader.theme = 'sepia';
                viewport.className = "flex-grow overflow-y-auto p-2 sm:p-6 flex flex-col items-center gap-2 reader-sepia";
            } else if (state.reader.theme === 'sepia') {
                state.reader.theme = 'light';
                viewport.className = "flex-grow overflow-y-auto p-2 sm:p-6 flex flex-col items-center gap-2 reader-light";
            } else {
                state.reader.theme = 'dark';
                viewport.className = "flex-grow overflow-y-auto p-2 sm:p-6 flex flex-col items-center gap-2 reader-dark";
            }
        }

        function renderReaderPages() {
            const viewport = document.getElementById('reader-viewport');
            const flipFooter = document.getElementById('reader-flip-footer');
            const manga = mangaCache[state.reader.mangaId];
            const cover = manga.coverImage.extraLarge || manga.coverImage.large || FALLBACK_IMAGE;

            const mockPages = [
                cover,
                "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=800&q=80",
                "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80"
            ];

            if (state.reader.mode === 'vertical') {
                flipFooter.classList.add('hidden');
                viewport.innerHTML = mockPages.map((src, idx) => `
                    <div class="max-w-2xl w-full shadow-2xl relative">
                        <img src="${src}" alt="Page ${idx + 1}" onerror="this.src='${FALLBACK_IMAGE}'" class="w-full h-auto rounded-md border border-slate-800">
                        <span class="absolute bottom-2 right-2 px-2 py-1 bg-black/70 text-white text-[10px] rounded backdrop-blur">Page ${idx + 1}</span>
                    </div>
                `).join('') + `
                    <div class="py-12 text-center space-y-3">
                        <p class="text-sm text-slate-400">End of Chapter ${state.reader.chapter}</p>
                        ${state.reader.chapter < (manga.chapters || 50) ? `
                            <button onclick="switchReaderChapter(${state.reader.chapter + 1})" class="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-600/30 transition-all">
                                Next Chapter (${state.reader.chapter + 1}) <i class="fa-solid fa-arrow-right ml-1"></i>
                            </button>
                        ` : ''}
                    </div>
                `;
            } else {
                flipFooter.classList.remove('hidden');
                state.reader.totalPages = mockPages.length;
                document.getElementById('reader-page-indicator').textContent = `Page ${state.reader.currentPage} / ${state.reader.totalPages}`;

                viewport.innerHTML = `
                    <div class="max-w-xl w-full flex-grow flex items-center justify-center p-4">
                        <img src="${mockPages[state.reader.currentPage - 1]}" alt="Page ${state.reader.currentPage}" onerror="this.src='${FALLBACK_IMAGE}'" class="max-h-[80vh] w-auto object-contain rounded-lg shadow-2xl border border-slate-800">
                    </div>
                `;
            }
        }

        function prevFlipPage() {
            if (state.reader.currentPage > 1) {
                state.reader.currentPage--;
                renderReaderPages();
            }
        }

        function nextFlipPage() {
            if (state.reader.currentPage < state.reader.totalPages) {
                state.reader.currentPage++;
                renderReaderPages();
            } else {
                const manga = mangaCache[state.reader.mangaId];
                if (state.reader.chapter < (manga.chapters || 50)) {
                    switchReaderChapter(state.reader.chapter + 1);
                }
            }
        }