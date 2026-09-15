const fs = require('fs');
let html = fs.readFileSync('admin.html', 'utf8');

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

html = html.replace(/<!-- ============ 4\. PAID COURSES VIEW ============ -->\s*<!-- ============ 5\. ORDERS & FAIL-SAFE ACCESS VIEW ============ -->/, viewsInjection);

fs.writeFileSync('admin.html', html);
