require('dotenv').config();
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

async function testAdminAddBook() {
  console.log('🚀 Starting Comprehensive Admin Book Publishing Test Suite...\n');

  try {
    // -------------------------------------------------------------
    // Step 1: Admin Login
    // -------------------------------------------------------------
    console.log('--- Step 1: Admin Authentication ---');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@bookvault.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const authData = await loginRes.json();
    if (!authData.success || !authData.token) {
      throw new Error(`Admin login failed: ${authData.message}`);
    }
    const adminToken = authData.token;
    console.log(`✓ Admin logged in: ${adminEmail}`);

    // -------------------------------------------------------------
    // Step 2: Publish eBook without manual PDF (Auto-PDF Generation)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Admin Adds Book with Auto-Generated Branded PDF ---');
    const form1 = new FormData();
    form1.append('title', `Generative AI & LLM Systems in Production ${Date.now().toString().slice(-4)}`);
    form1.append('author', 'Dr. Aris Thorne');
    form1.append('category', 'Artificial Intelligence');
    form1.append('price', '699');
    form1.append('originalPrice', '1299');
    form1.append('pages', '280');
    form1.append('language', 'English');
    form1.append('description', 'A definitive production guide to fine-tuning, RAG pipelines, latency benchmarking, and deploying large language models at enterprise scale.');
    form1.append('featured', 'true');
    form1.append('coverImageUrl', 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=600&q=80');

    const res1 = await fetch(`${BASE_URL}/api/admin/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form1,
    });
    const data1 = await res1.json();
    if (!data1.success || !data1.book) {
      throw new Error(`Publish book 1 failed: ${JSON.stringify(data1)}`);
    }
    const book1 = data1.book;
    console.log(`✓ Successfully published: "${book1.title}" (ID: ${book1._id})`);
    console.log(`  - Category: ${book1.category}`);
    console.log(`  - Price: ₹${book1.price} (Original: ₹${book1.originalPrice})`);
    console.log(`  - Auto-generated PDF: ${book1.pdfFileName}`);
    console.log(`  - Structured Chapters Count: ${book1.chapters ? book1.chapters.length : 0}`);

    // Verify PDF file exists in storage/books
    const pdfPath1 = path.join(__dirname, 'storage', 'books', book1.pdfFileName);
    if (!fs.existsSync(pdfPath1)) {
      throw new Error(`Auto-generated PDF file does not exist on disk: ${pdfPath1}`);
    }
    const pdfStat1 = fs.statSync(pdfPath1);
    console.log(`✓ Verified PDF exists in secure vault: ${pdfStat1.size} bytes`);

    // -------------------------------------------------------------
    // Step 3: Publish eBook WITH uploaded PDF file
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Admin Adds Book with Uploaded PDF File ---');
    // Create temporary PDF file to upload
    const tempPdfPath = path.join(__dirname, 'temp_test_book.pdf');
    fs.writeFileSync(tempPdfPath, '%PDF-1.4\n%Test Admin Upload PDF File\n%%EOF');

    const form2 = new FormData();
    form2.append('title', `Zero to Cloud Architect: AWS & GCP ${Date.now().toString().slice(-4)}`);
    form2.append('author', 'Kavita Patel');
    form2.append('category', 'Cloud & Architecture');
    form2.append('price', '549');
    form2.append('originalPrice', '999');
    form2.append('pages', '210');
    form2.append('description', 'Master multi-region high availability, VPC peering, Kubernetes clusters, and Terraform infrastructure as code.');
    
    // Attach file
    const fileBuffer = fs.readFileSync(tempPdfPath);
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });
    form2.append('pdfFile', blob, 'Zero_To_Cloud_Architect.pdf');

    const res2 = await fetch(`${BASE_URL}/api/admin/books`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form2,
    });
    const data2 = await res2.json();
    if (!data2.success || !data2.book) {
      throw new Error(`Publish book 2 failed: ${JSON.stringify(data2)}`);
    }
    const book2 = data2.book;
    console.log(`✓ Successfully published uploaded book: "${book2.title}" (ID: ${book2._id})`);
    console.log(`  - Uploaded PDF filename: ${book2.pdfFileName}`);

    // Cleanup temp file
    if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);

    // -------------------------------------------------------------
    // Step 4: Verify Catalog & Public Search
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Verify Books in Storefront Catalog ---');
    const catalogRes = await fetch(`${BASE_URL}/api/books`);
    const catalogData = await catalogRes.json();
    const foundBook1 = catalogData.books.find((b) => b._id.toString() === book1._id.toString());
    const foundBook2 = catalogData.books.find((b) => b._id.toString() === book2._id.toString());
    if (!foundBook1 || !foundBook2) {
      throw new Error('New books not found in public catalog!');
    }
    console.log(`✓ Catalog verified: Total ${catalogData.books.length} eBooks available on store.`);
    console.log(`  - Found "${foundBook1.title}" in category [${foundBook1.category}]`);
    console.log(`  - Found "${foundBook2.title}" in category [${foundBook2.category}]`);

    // -------------------------------------------------------------
    // Step 5: Test Free Sample Preview
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Verify Free Sample Preview Endpoint ---');
    const prevRes = await fetch(`${BASE_URL}/api/books/${book1._id}/preview`);
    const prevData = await prevRes.json();
    if (!prevData.success || !prevData.preview) {
      throw new Error(`Preview fetch failed: ${JSON.stringify(prevData)}`);
    }
    console.log(`✓ Free sample preview loaded: "${prevData.title}" (${prevData.preview.length} chars)`);

    // -------------------------------------------------------------
    // Step 6: Admin Updates eBook Details
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Admin Edits eBook (PUT /api/admin/books/:id) ---');
    const updateForm = new FormData();
    updateForm.append('title', `${book1.title} [Updated 2nd Edition]`);
    updateForm.append('author', book1.author);
    updateForm.append('category', book1.category);
    updateForm.append('price', '799'); // Price updated
    updateForm.append('originalPrice', '1499');
    updateForm.append('description', 'Updated 2nd edition with LangChain v0.2 and Llama 3 benchmarks.');

    const updateRes = await fetch(`${BASE_URL}/api/admin/books/${book1._id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: updateForm,
    });
    const updateData = await updateRes.json();
    if (!updateData.success || updateData.book.price !== 799) {
      throw new Error(`Update failed: ${JSON.stringify(updateData)}`);
    }
    console.log(`✓ Successfully updated eBook: "${updateData.book.title}" -> Price updated to ₹${updateData.book.price}`);

    // -------------------------------------------------------------
    // Step 7: Admin Deletes eBook
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Admin Deletes eBook (DELETE /api/admin/books/:id) ---');
    const delRes = await fetch(`${BASE_URL}/api/admin/books/${book2._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const delData = await delRes.json();
    if (!delData.success) {
      throw new Error(`Delete failed: ${JSON.stringify(delData)}`);
    }
    console.log(`✓ Successfully deleted eBook: "${delData.message}"`);

    // Verify it is gone from catalog
    const checkDelRes = await fetch(`${BASE_URL}/api/books/${book2._id}`);
    if (checkDelRes.status !== 404) {
      throw new Error(`Deleted book still accessible! Received status: ${checkDelRes.status}`);
    }
    console.log('✓ Confirmed: Deleted book returns HTTP 404 Not Found.');

    // -------------------------------------------------------------
    // Step 8: Verify Reader Content for Admin
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Verify In-Browser Reader Content ---');
    const readerRes = await fetch(`${BASE_URL}/api/download/reader-content/${book1._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const readerData = await readerRes.json();
    if (!readerData.success || !readerData.chapters || readerData.chapters.length === 0) {
      throw new Error(`Reader content failed: ${JSON.stringify(readerData)}`);
    }
    console.log(`✓ Reader content loaded: ${readerData.chapters.length} chapters found.`);
    readerData.chapters.forEach((ch, idx) => {
      console.log(`  - Chapter ${idx + 1}: ${ch.title}`);
    });

    console.log('\n🎉 ALL ADMIN BOOK ADD & MANAGEMENT TESTS PASSED 100% SUCCESSFULLY! 🎉\n');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

testAdminAddBook();
