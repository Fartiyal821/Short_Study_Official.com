const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

// Restore Sidebar
const sidebarInjection = `
        <a href="#paid-courses" class="nav-link" data-tab="paid-courses">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          <span>Paid Courses</span>
          <span class="nav-counter" id="paid-course-count-badge">0</span>
        </a>
        <a href="#orders" class="nav-link" data-tab="orders">
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path>
            <rect x="9" y="3" width="6" height="4" rx="2"></rect>
          </svg>
          <span>Orders</span>
          <span class="nav-counter" id="orders-count-badge" style="background:#ef4444; color:white;">0</span>
        </a>
`;

// It was right after post-count-badge
if (!html.includes('data-tab="paid-courses"')) {
    html = html.replace(/(<span class="nav-counter" id="post-count-badge">0<\/span>\s*<\/a>)/, `$1\n${sidebarInjection}`);
}

// Restore Metrics
const metricsInjection = `
            <div class="metric-card">
              <div>
                <div class="metric-label">Paid Courses</div>
                <div class="metric-value" id="metric-total-paid-courses" style="color: #F2C94C;">0</div>
              </div>
              <div class="metric-icon-box" style="background: rgba(242, 201, 76, 0.15); color: #F2C94C; border-color: rgba(242, 201, 76, 0.3);">⭐</div>
            </div>

            <div class="metric-card">
              <div>
                <div class="metric-label">Pending Access Orders</div>
                <div class="metric-value" id="metric-pending-orders" style="color: #f59e0b;">0</div>
              </div>
              <div class="metric-icon-box" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">⚠️</div>
            </div>
`;
if (!html.includes('metric-total-paid-courses')) {
    html = html.replace(/(<div class="metric-value" id="metric-total-posts">0<\/div>\s*<\/div>\s*<div class="metric-icon-box" style="background: rgba\(16, 185, 129, 0\.15\); color: #10b981; border-color: rgba\(16, 185, 129, 0\.3\);">📝<\/div>\s*<\/div>)/, `$1\n${metricsInjection}`);
}

// Restore views
const viewsInjection = `
        <!-- ============ 4. PAID COURSES VIEW ============ -->
        <section class="view-section" id="view-paid-courses">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Paid Masterclasses (CodeWithHarry Style)</h2>
              <p style="font-size: 13px; color: var(--text-muted);">Manage premium tracks. High-conversion landing page layouts.</p>
            </div>
            <div style="display:flex; gap:10px;">
              <input type="text" id="paid-course-search" class="form-input" placeholder="Search premium courses..." style="width: 250px;">
              <button class="btn btn-primary" id="btn-new-paid-course">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>New Paid Course</span>
              </button>
            </div>
          </div>
          <div class="table-container">
            <table class="data-table" id="paid-courses-table">
              <thead>
                <tr>
                  <th width="30%">Title & Info</th>
                  <th width="15%">Category</th>
                  <th width="15%">Price</th>
                  <th width="15%">Badge/Status</th>
                  <th width="25%">Actions</th>
                </tr>
              </thead>
              <tbody id="paid-courses-table-body">
                <!-- JS populated -->
              </tbody>
            </table>
          </div>
        </section>

        <!-- ============ 5. ORDERS & FAIL-SAFE ACCESS VIEW ============ -->
        <section class="view-section" id="view-orders">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Student Orders &amp; Fail-Safe Access Ledger</h2>
              <p style="font-size: 13px; color: var(--text-muted);">
                Real-time transaction logs. <strong>Fail-Safe Alert:</strong> Any orders where automated access dropped are captured here under <em>Pending/Manual Access Required</em> for instant 1-click admin approval.
              </p>
            </div>
          </div>
          <div class="table-container">
            <table class="data-table" id="orders-table">
              <thead>
                <tr>
                  <th width="25%">Transaction ID & Date</th>
                  <th width="25%">Student / Email</th>
                  <th width="25%">Course Name</th>
                  <th width="15%">Amount</th>
                  <th width="10%">Status / Access</th>
                </tr>
              </thead>
              <tbody id="orders-table-body">
                <!-- JS Populated -->
              </tbody>
            </table>
          </div>
        </section>
`;
if (!html.includes('id="view-paid-courses"')) {
    html = html.replace(/(<\/section>\s*<\/div>\s*<\/main>)/, `</section>\n${viewsInjection}\n      </div>\n    </main>`);
}

// Restore Modal
const modalInjection = `
  <!-- =========================================================
       MODAL: CREATE / EDIT PAID COURSE (CODEWITHHARRY STYLE)
       ========================================================= -->
  <div class="modal-overlay" id="paid-course-modal">
    <div class="modal-content" style="max-width: 900px; padding: 24px; max-height: 90vh; overflow-y: auto;">
      <div class="modal-header">
        <h3 class="modal-title" id="paid-course-modal-heading">Add Paid Video Course</h3>
        <button class="modal-close" id="paid-course-modal-close" type="button">&times;</button>
      </div>
      <form id="paid-course-form" style="margin-top: 16px;">
        <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <!-- LEFT COLUMN: PRICING & VISUALS -->
          <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid var(--border-slate); border-radius: 8px; padding: 16px;">
            <h4 style="font-size: 14px; font-weight: 700; color: #ef4444; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; border-bottom: 1px solid rgba(239, 68, 68, 0.3); padding-bottom: 6px;">
              💰 Pricing & Conversion Engine
            </h4>
            
            <div class="form-group">
              <label class="form-label" for="paid-modal-title">Masterclass Title</label>
              <input type="text" id="paid-modal-title" class="form-input" placeholder="e.g. Master React JS 2026" required>
            </div>

            <div class="form-row" style="margin-bottom: 8px;">
              <div class="form-group">
                <label class="form-label" for="paid-modal-price" style="color: #10b981;">Selling Price (₹)</label>
                <input type="text" id="paid-modal-price" class="form-input" placeholder="e.g. ₹2599" value="₹2599" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="paid-modal-orig-price" style="color: var(--text-muted); text-decoration: line-through;">Original Price</label>
                <input type="text" id="paid-modal-orig-price" class="form-input" placeholder="e.g. ₹3899" value="₹3899">
              </div>
            </div>
            
            <!-- Live Discount Badge Output -->
            <div id="paid-modal-discount-calc" style="margin-top: 8px; padding: 10px 14px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 6px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <span id="paid-modal-discount-text" style="color: #ef4444; font-weight: 700; font-size: 13px;">🔥 33% OFF</span>
              <span id="paid-modal-discount-savings" style="color: var(--text-white); font-size: 12.5px;">Cost Reduction: Student Saves ₹1,300</span>
            </div>
          </div>

          <!-- 5. COURSE METADATA & FEATURED BADGE -->
          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-slate); border-radius: 8px; padding: 14px; margin-bottom: 16px;">
            <span style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: var(--text-white); letter-spacing: 0.5px; display: block; margin-bottom: 10px;">
              📊 Course Meta Attributes (Matches Screenshot Badges)
            </span>
            <div class="form-row" style="margin-bottom: 10px;">
              <div class="form-group">
                <label class="form-label" for="paid-modal-category">Website Track / Category</label>
                <select id="paid-modal-category" class="form-select">
                  <option value="all">All / General Masterclass</option>
                  <option value="datascience">Data Science &amp; Analytics</option>
                  <option value="webdev">Web Development</option>
                  <option value="programming">Programming &amp; Systems</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="paid-modal-instructor">Instructor Name</label>
                <input type="text" id="paid-modal-instructor" class="form-input" placeholder="e.g. CodeWithHarry or ShortStudy" value="ShortStudy">
              </div>
            </div>
            <div class="form-row" style="margin-bottom: 10px;">
              <div class="form-group">
                <label class="form-label" for="paid-modal-duration">Total Duration</label>
                <input type="text" id="paid-modal-duration" class="form-input" placeholder="e.g. 36h 22m" value="36h 22m">
              </div>
              <div class="form-group">
                <label class="form-label" for="paid-modal-lessons">Total Lessons</label>
                <input type="text" id="paid-modal-lessons" class="form-input" placeholder="e.g. 219 lessons" value="219 lessons">
              </div>
            </div>
            <div class="form-row" style="margin-bottom: 10px;">
              <div class="form-group">
                <label class="form-label" for="paid-modal-language">Language</label>
                <input type="text" id="paid-modal-language" class="form-input" placeholder="e.g. Hindi" value="Hindi">
              </div>
              <div class="form-group">
                <label class="form-label" for="paid-modal-level">Difficulty Level</label>
                <select id="paid-modal-level" class="form-select">
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                  <option value="All Levels">All Levels</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="paid-modal-badge">Highlight Badge</label>
                <input type="text" id="paid-modal-badge" class="form-input" placeholder="e.g. Featured Masterclass" value="Featured Masterclass">
              </div>
              <div class="form-group" style="display: flex; align-items: center; gap: 10px; margin-top: 24px;">
                <input type="checkbox" id="paid-modal-featured" style="width: 18px; height: 18px; cursor: pointer;">
                <label for="paid-modal-featured" style="color: var(--text-white); font-weight: 600; cursor: pointer; user-select: none;">⭐ Mark as Global Featured Course</label>
              </div>
            </div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label" for="paid-modal-desc">Short Marketing Description</label>
          <textarea id="paid-modal-desc" class="form-input" rows="3" placeholder="Why should they buy this?"></textarea>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="paid-modal-image">Thumbnail Image URL</label>
          <input type="text" id="paid-modal-image" class="form-input" placeholder="/assets/img/course.jpg">
          <div style="margin-top:10px;">
             <input type="file" id="paid-modal-image-file" accept="image/*" class="form-input" style="padding: 6px;">
             <small style="color: var(--text-muted); display: block; margin-top: 4px;">Upload from computer (Admin API Storage via Data URI)</small>
          </div>
          <div id="paid-modal-image-preview-container" style="display: none; margin-top: 10px;">
            <img id="paid-modal-image-preview" src="" alt="Thumbnail Preview" style="max-width: 250px; border-radius: 8px; border: 1px solid var(--border-slate);">
          </div>
        </div>

        <div class="form-group" style="margin-top: 20px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <label class="form-label" style="margin:0;">Video Chapters / Curriculum</label>
            <button type="button" class="btn btn-secondary btn-sm" id="btn-add-paid-video">+ Add Video</button>
          </div>
          <div id="paid-modal-videos-list" style="background: rgba(15,23,42,0.3); border:1px solid var(--border-slate); border-radius:6px; padding:12px;">
            <div style="color: var(--text-muted); font-size: 13px; font-style: italic; text-align: center; padding: 10px;">No videos added yet.</div>
          </div>
        </div>

        <div class="form-group" style="margin-top: 20px;">
           <label class="form-label" for="paid-modal-status">Course Status</label>
           <select id="paid-modal-status" class="form-select">
             <option value="published">Published (Live to Students)</option>
             <option value="draft">Draft (Hidden)</option>
           </select>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" id="paid-course-modal-cancel">Cancel</button>
          <button type="submit" class="btn btn-primary" id="paid-course-modal-submit">Save Paid Course</button>
        </div>
      </form>
    </div>
  </div>
`;
if (!html.includes('id="paid-course-modal"')) {
    html = html.replace(/(<!-- =========================================================\s*MODAL: DELETE CONFIRMATION)/, `${modalInjection}\n  $1`);
}

fs.writeFileSync('admin.html', html);
console.log('Restored admin.html');
