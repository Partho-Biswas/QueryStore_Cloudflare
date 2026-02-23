document.addEventListener('DOMContentLoaded', async () => {
    const queryContainer = document.getElementById('query-container');

    const escapeHTML = (str) => {
        const p = document.createElement('p');
        p.appendChild(document.createTextNode(str));
        return p.innerHTML;
    };

    const renderQuery = (query) => {
        const tagsHtml = query.tags.map(tag => `<span class="badge bg-secondary me-1">${escapeHTML(tag)}</span>`).join('');
        queryContainer.innerHTML = `
            <div class="card">
                <div class="card-header d-flex justify-content-between">
                    <h5 class="mb-0">${escapeHTML(query.title)}</h5>
                    <small>Created: ${new Date(query.createdAt).toLocaleString()}</small>
                </div>
                <div class="card-body">
                    <div class="mb-2">${tagsHtml}</div>
                    <div class="query-content mt-2">
                        <pre><code class="sql">${escapeHTML(query.text)}</code></pre>
                    </div>
                </div>
            </div>
        `;
        hljs.highlightAll();
    };

    const fetchSharedQuery = async () => {
        const params = new URLSearchParams(window.location.search);
        const shareId = params.get('id');

        if (!shareId) {
            queryContainer.innerHTML = '<p class="text-center text-danger">No share ID provided.</p>';
            return;
        }

        try {
            const response = await fetch(`/api/public/queries/${shareId}`);
            if (!response.ok) {
                throw new Error('Shared query not found or access denied.');
            }
            const query = await response.json();
            renderQuery(query);
        } catch (error) {
            console.error(error);
            queryContainer.innerHTML = `<p class="text-center text-danger">${error.message}</p>`;
        }
    };

    fetchSharedQuery();
});
