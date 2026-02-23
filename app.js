document.addEventListener('DOMContentLoaded', async () => {
    // Main form elements
    const addQueryForm = document.getElementById('add-query-form');
    const queryTitleInput = document.getElementById('query-title');
    const queryTextInput = document.getElementById('query-text');
    const queryTagsInput = document.getElementById('query-tags');
    const queryList = document.getElementById('query-list');
    const searchBox = document.getElementById('search-box');
    
    // Tags filter elements
    const tagsList = document.getElementById('tags-list');

    // Edit Modal Elements
    const editModal = new bootstrap.Modal(document.getElementById('edit-query-modal'));
    const editQueryIdInput = document.getElementById('edit-query-id');
    const editQueryTitleInput = document.getElementById('edit-query-title');
    const editQueryTextInput = document.getElementById('edit-query-text');
    const editQueryTagsInput = document.getElementById('edit-query-tags');
    const saveQueryButton = document.getElementById('save-query-button');

    // Share Modal Elements
    const shareModal = new bootstrap.Modal(document.getElementById('share-link-modal'));
    const shareLinkInput = document.getElementById('share-link-input');
    const copyShareLinkButton = document.getElementById('copy-share-link-button');

    // --- Auth & Globals ---
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }

    const API_URL = '/api';
    let allQueries = [];
    let activeTagFilter = null;

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
    
    // --- Utility Functions ---
    const processTags = (tagsString) => {
        return tagsString.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag);
    };

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    }

    // --- API Functions ---

    const fetchAllData = async () => {
        await Promise.all([fetchQueries(), fetchTags()]);
    };

    const fetchQueries = async () => {
        try {
            const response = await fetch(`${API_URL}/queries`, { headers: authHeaders });
            if (response.status === 401) {
                localStorage.clear();
                window.location.href = 'auth.html';
            }
            if (!response.ok) throw new Error('Failed to fetch queries.');
            allQueries = await response.json();
            renderQueries(allQueries);
        } catch (error) {
            console.error(error.message);
            queryList.innerHTML = '<p class="text-center text-danger">Error loading queries.</p>';
        }
    };
    
    const fetchTags = async () => {
        try {
            const response = await fetch(`${API_URL}/tags`, { headers: authHeaders });
            if (!response.ok) throw new Error('Failed to fetch tags.');
            const tags = await response.json();
            renderTags(tags);
        } catch (error) {
            console.error(error.message);
        }
    };

    const addQuery = async (title, text, tags) => {
        try {
            const response = await fetch(`${API_URL}/queries`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ title, text, tags }),
            });
            if (!response.ok) throw new Error('Failed to save query.');
            addQueryForm.reset();
            fetchAllData();
        } catch (error) {
            console.error(error.message);
            alert('Failed to save your query.');
        }
    };

    const deleteQuery = async (queryId) => {
        if (!confirm('Are you sure you want to delete this query?')) return;
        try {
            const response = await fetch(`${API_URL}/queries/${queryId}`, { 
                method: 'DELETE',
                headers: authHeaders 
            });
            if (!response.ok) throw new Error('Failed to delete query.');
            fetchAllData();
        } catch (error) {
            console.error(error.message);
            alert('Failed to delete the query.');
        }
    };

    const updateQuery = async (queryId, title, text, tags) => {
        try {
            const response = await fetch(`${API_URL}/queries/${queryId}`, {
                method: 'PUT',
                headers: authHeaders,
                body: JSON.stringify({ title, text, tags }),
            });
            if (!response.ok) throw new Error('Failed to update query.');
            editModal.hide();
            fetchAllData();
        } catch (error) {
            console.error(error.message);
            alert('Failed to update the query.');
        }
    };

    const shareQuery = async (queryId) => {
        try {
            const response = await fetch(`${API_URL}/queries/${queryId}/share`, {
                method: 'POST',
                headers: authHeaders,
            });
            if (!response.ok) throw new Error('Failed to generate share link.');
            const { shareId } = await response.json();
            const shareLink = `${window.location.origin}/share.html?id=${shareId}`;
            shareLinkInput.value = shareLink;
            shareModal.show();
        } catch (error) {
            console.error(error.message);
            alert('Failed to generate share link.');
        }
    };

    // --- Rendering ---

    const renderQueries = (queries) => {
        queryList.innerHTML = '';
        if (queries.length === 0) {
            queryList.innerHTML = '<p class="text-center text-muted">No queries saved yet.</p>';
            return;
        }

        queries.forEach(query => {
            const queryItem = document.createElement('div');
            queryItem.className = 'list-group-item';
            queryItem.dataset.id = query._id;
            
            const tagsHtml = (query.tags || []).map(tag => `<span class="badge bg-secondary me-1">${escapeHTML(tag)}</span>`).join('');

            queryItem.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${escapeHTML(query.title)}</h5>
                    <small>${new Date(query.createdAt).toLocaleString()}</small>
                </div>
                <div class="mb-2">${tagsHtml}</div>
                <div class="query-content mt-2">
                    <pre><code class="sql">${escapeHTML(query.text)}</code></pre>
                </div>
                <div class="query-actions text-end mt-2">
                    <button class="btn btn-sm btn-outline-info share-btn">
                        <i class="bi bi-share"></i> Share
                    </button>
                    <button class="btn btn-sm btn-outline-primary edit-btn">
                        <i class="bi bi-pencil-square"></i> Edit
                    </button>
                    <button class="btn btn-sm btn-outline-secondary copy-btn">
                        <i class="bi bi-clipboard"></i> Copy
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-btn">
                        <i class="bi bi-trash"></i> Delete
                    </button>
                </div>
            `;
            queryList.appendChild(queryItem);
        });

        hljs.highlightAll();
    };
    
    const renderTags = (tags) => {
        tagsList.innerHTML = '';
        if (tags.length === 0) return;
        
        const clearButton = document.createElement('button');
        clearButton.className = 'btn btn-sm btn-outline-danger me-2';
        clearButton.textContent = 'Clear Filter';
        clearButton.id = 'clear-tag-filter';
        tagsList.appendChild(clearButton);

        tags.forEach(tag => {
            const tagButton = document.createElement('button');
            tagButton.className = 'btn btn-sm btn-outline-primary me-1';
            tagButton.textContent = tag;
            tagButton.dataset.tag = tag;
            tagsList.appendChild(tagButton);
        });
    };

    // --- Event Listeners ---

    addQueryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = queryTitleInput.value.trim();
        const text = queryTextInput.value.trim();
        const tags = processTags(queryTagsInput.value);
        if (title && text) addQuery(title, text, tags);
    });

    queryList.addEventListener('click', (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const queryItem = target.closest('.list-group-item');
        const queryId = queryItem.dataset.id;

        if (target.classList.contains('delete-btn')) {
            deleteQuery(queryId);
        } else if (target.classList.contains('copy-btn')) {
            const queryText = queryItem.querySelector('.query-content code').innerText;
            navigator.clipboard.writeText(queryText).then(() => {
                target.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
                target.classList.add('btn-success');
                setTimeout(() => { 
                    target.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
                    target.classList.remove('btn-success');
                }, 2000);
            });
        } else if (target.classList.contains('edit-btn')) {
            const query = allQueries.find(q => q._id === queryId);
            if (query) {
                editQueryIdInput.value = query._id;
                editQueryTitleInput.value = query.title;
                editQueryTextInput.value = query.text;
                editQueryTagsInput.value = (query.tags || []).join(', ');
                editModal.show();
            }
        } else if (target.classList.contains('share-btn')) {
            shareQuery(queryId);
        }
    });

    saveQueryButton.addEventListener('click', () => {
        const isConfirming = saveQueryButton.dataset.confirming === 'true';

        if (isConfirming) {
            const id = editQueryIdInput.value;
            const title = editQueryTitleInput.value.trim();
            const text = editQueryTextInput.value.trim();
            const tags = processTags(editQueryTagsInput.value);
            if (id && title && text) {
                updateQuery(id, title, text, tags);
            }
            
            saveQueryButton.dataset.confirming = 'false';
            saveQueryButton.textContent = 'Save Changes';
            saveQueryButton.classList.replace('btn-warning', 'btn-primary');

        } else {
            saveQueryButton.dataset.confirming = 'true';
            saveQueryButton.textContent = 'Confirm Update?';
            saveQueryButton.classList.replace('btn-primary', 'btn-warning');

            setTimeout(() => {
                if (saveQueryButton.dataset.confirming === 'true') {
                    saveQueryButton.dataset.confirming = 'false';
                    saveQueryButton.textContent = 'Save Changes';
                    saveQueryButton.classList.replace('btn-warning', 'btn-primary');
                }
            }, 3000);
        }
    });
    
    document.getElementById('edit-query-modal').addEventListener('hidden.bs.modal', () => {
        saveQueryButton.dataset.confirming = 'false';
        saveQueryButton.textContent = 'Save Changes';
        saveQueryButton.classList.replace('btn-warning', 'btn-primary');
    });

    copyShareLinkButton.addEventListener('click', () => {
        shareLinkInput.select();
        document.execCommand('copy');
        const originalText = copyShareLinkButton.innerHTML;
        copyShareLinkButton.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
        setTimeout(() => {
            copyShareLinkButton.innerHTML = originalText;
        }, 2000);
    });

    tagsList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.id === 'clear-tag-filter') {
            activeTagFilter = null;
            renderQueries(allQueries);
            document.querySelectorAll('#tags-list .btn').forEach(b => b.classList.remove('active'));
        } else if (target.dataset.tag) {
            activeTagFilter = target.dataset.tag;
            const filteredQueries = allQueries.filter(q => (q.tags || []).includes(activeTagFilter));
            renderQueries(filteredQueries);
            
            document.querySelectorAll('#tags-list .btn').forEach(b => b.classList.remove('active'));
            target.classList.add('active');
        }
    });

    searchBox.addEventListener('input', () => {
        const searchTerm = searchBox.value.toLowerCase();
        let queriesToSearch = activeTagFilter 
            ? allQueries.filter(q => (q.tags || []).includes(activeTagFilter))
            : allQueries;
        
        const filteredQueries = queriesToSearch.filter(q =>
            q.title.toLowerCase().includes(searchTerm) ||
            q.text.toLowerCase().includes(searchTerm)
        );
        renderQueries(filteredQueries);
    });

    // --- Initial Load ---
    fetchAllData();
});