import fitz

def create_manual_pdf():
    doc = fitz.open()
    
    # ------------------ PAGE 1: COVER & EXECUTIVE SUMMARY ------------------
    page1 = doc.new_page(width=595, height=842) # Standard A4
    
    # Background Top Header Bar (Orange Gradient feel)
    header_rect = fitz.Rect(30, 30, 565, 140)
    page1.draw_rect(header_rect, color=(0.91, 0.35, 0.05), fill=(0.95, 0.42, 0.08), radius=12)
    
    # Header Content (HTML box for rich styling and font fallback)
    header_html = """
    <div style="font-family: 'Segoe UI', 'Nirmala UI', sans-serif; color: #ffffff; padding: 12px 18px;">
        <div style="font-size: 11px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: #ffedd5;">
            MAST LIFE OS &bull; OFFICIAL USER & SCHOOL PRESENTATION MANUAL
        </div>
        <div style="font-size: 24px; font-weight: bold; margin-top: 4px; letter-spacing: -0.5px;">
            MAST Life OS &mdash; सम्पूर्ण यूजर गाइड व स्कूल प्रेजेंटेशन गाइड
        </div>
        <div style="font-size: 13px; color: #fed7aa; margin-top: 6px;">
            हर परिवार और स्कूल की सुरक्षा, स्वास्थ्य व दैनिक प्रबंधन का 100% भरोसेमंद साथी
        </div>
    </div>
    """
    page1.insert_htmlbox(header_rect, header_html)
    
    # Executive School Pitch Box
    body_rect1 = fitz.Rect(30, 155, 565, 790)
    body_html1 = """
    <div style="font-family: 'Segoe UI', 'Nirmala UI', sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="font-size: 16px; color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 4px; margin-top: 10px; margin-bottom: 8px;">
            🏫 1. स्कूल में प्रेजेंटेशन हेतु 5 मुख्य बिंदु (School Presentation Highlights)
        </h2>
        <p style="font-size: 12px; color: #334155; margin-bottom: 10px;">
            कल स्कूल प्रबंधन और प्रधानाचार्य (Principal) के समक्ष डेमो प्रस्तुत करते समय इन 5 महत्वपूर्ण विशेषताओं को प्रमुखता से दिखाएं:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #ea580c; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="font-size: 13px; color: #c2410c;">🚌 1. ज़ीरो-बर्डन ड्राइवर व कंडक्टर बोर्डिंग रोस्टर (Zero-Burden Driver & Attendance)</strong>
            <p style="font-size: 11.5px; color: #475569; margin: 4px 0 0 0;">
                &bull; <strong>ड्राइवर के लिए आसान:</strong> गाड़ी चलाते समय ड्राइवर को स्क्रीन छूने की कोई आवश्यकता नहीं है। 1-टैप में ड्यूटी शुरू होती है और फोन डैशबोर्ड पर रख दिया जाता है।<br/>
                &bull; <strong>कंडक्टर उपस्थिति रोस्टर:</strong> बच्चे के बस में चढ़ते ही कंडक्टर 'सवार ✓' पर टैप करता है और माता-पिता को तुरंत तसल्ली का नोटिफिकेशन मिल जाता है।
            </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="font-size: 13px; color: #0369a1;">🌙 2. रात्रि डिपो पार्किंग व 2-शिफ्ट रूट (Overnight Stand & Dual Shift)</strong>
            <p style="font-size: 11.5px; color: #475569; margin: 4px 0 0 0;">
                &bull; <strong>वास्तविक रूट लॉजिक:</strong> स्कूल बस रात में स्कूल में नहीं, बल्कि अपने रूट के अंतिम डिपो स्टैंड पर पार्क रहती है। सुबह बच्चों को पिक करने वहीं से निकलती है और दोपहर में स्कूल से घर ड्रॉप करती है।<br/>
                &bull; ऑफ-ड्यूटी होने पर स्क्रीन पर स्पष्ट दिखता है: 'बस अंतिम डिपो स्टैंड पर सुरक्षित खड़ी है'।
            </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #16a34a; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="font-size: 13px; color: #15803d;">💳 3. स्कूल व बस फीस स्वतः सिंक (Automatic Fee Due Alerts)</strong>
            <p style="font-size: 11.5px; color: #475569; margin: 4px 0 0 0;">
                &bull; जब अभिभावक बच्चे का नाम व बस जोड़ते हैं, तो स्कूल फीस व बस फीस का नियत दिन (Due Date) होम स्क्रीन और रिमाइंडर में स्वतः लिंक हो जाता है।<br/>
                &bull; हर महीने नियत तिथि से पहले अभिभावक को समय पर फीस जमा करने का अलर्ट मिलता है।
            </p>
        </div>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #9333ea; padding: 10px 14px; border-radius: 8px; margin-bottom: 10px;">
            <strong style="font-size: 13px; color: #7e22ce;">🌐 4. 100% द्विभाषी सुविधा (Seamless English + Hindi Switcher)</strong>
            <p style="font-size: 11.5px; color: #475569; margin: 4px 0 0 0;">
                &bull; केवल 1-टैप में पूरा ऐप, कैलेंडर (महीने, दिन, चिप्स), फॉर्म्स और अलर्ट्स 100% शुद्ध अंग्रेजी या हिंदी में बदल जाते हैं। दक्षिण भारतीय और गैर-हिंदी भाषी परिवार भी इसे आसानी से उपयोग कर सकते हैं।
            </p>
        </div>

        <div style="background-color: #eff6ff; border: 1px dashed #3b82f6; padding: 10px 14px; border-radius: 8px; margin-top: 10px;">
            <strong style="font-size: 12px; color: #1e40af;">📡 5. स्कूल हार्डवेयर GPS (AIS-140) एकीकरण:</strong>
            <span style="font-size: 11.5px; color: #1e3a8a;"> यदि स्कूल की बस में पहले से GPS ट्रैकर लगा है, तो स्कूल कोड और व्हीकल नंबर डालते ही बस की चाबी घूमते ही MAST 100% ऑटोमैटिक लाइव लोकेशन दिखाने लगता है।</span>
        </div>
    </div>
    """
    page1.insert_htmlbox(body_rect1, body_html1)
    
    # ------------------ PAGE 2: USER MANUAL & MODULE GUIDE ------------------
    page2 = doc.new_page(width=595, height=842)
    
    header_rect2 = fitz.Rect(30, 30, 565, 80)
    page2.draw_rect(header_rect2, color=(0.12, 0.16, 0.23), fill=(0.06, 0.09, 0.16), radius=8)
    header_html2 = """
    <div style="font-family: 'Segoe UI', 'Nirmala UI', sans-serif; color: #ffffff; padding: 10px 16px;">
        <div style="font-size: 16px; font-weight: bold; color: #fed7aa;">
            📱 2. MAST Life OS &mdash; सभी 6 मॉड्यूल्स की यूजर गाइड (Feature Guide)
        </div>
        <div style="font-size: 11.5px; color: #94a3b8; margin-top: 2px;">
            परिवार के दैनिक जीवन, सुरक्षा, वित्त और स्वास्थ्य के सभी टूल्स का विस्तृत विवरण
        </div>
    </div>
    """
    page2.insert_htmlbox(header_rect2, header_html2)
    
    body_rect2 = fitz.Rect(30, 95, 565, 810)
    body_html2 = """
    <div style="font-family: 'Segoe UI', 'Nirmala UI', sans-serif; color: #0f172a; line-height: 1.45; font-size: 11px;">
        <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; text-align: left;">
                    <th style="padding: 6px 10px; width: 28%; font-size: 11px; color: #334155;">टैब / मॉड्यूल</th>
                    <th style="padding: 6px 10px; width: 44%; font-size: 11px; color: #334155;">मुख्य कार्यक्षमता (Features)</th>
                    <th style="padding: 6px 10px; width: 28%; font-size: 11px; color: #334155;">दैनिक उपयोग विधि</th>
                </tr>
            </thead>
            <tbody>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 7px 10px;">
                        <strong style="color: #ea580c; font-size: 12px;">🏠 1. आज (Home)</strong><br/>
                        <span style="color: #64748b; font-size: 10px;">Today's Agenda & Tasks</span>
                    </td>
                    <td style="padding: 7px 10px; color: #334155;">
                        &bull; यूजर नाम से अभिवादन (उदा: शुभ प्रभात, अमित!)<br/>
                        &bull; <strong>आज की गतिविधियाँ व कार्य</strong> (1-टैप [✓] चेक)<br/>
                        &bull; आज की दवाइयाँ, अलार्म व प्रिस्क्रिप्शन पर्ची<br/>
                        &bull; मासिक बजट प्रोग्रेस बार व त्वरित टाइल्स
                    </td>
                    <td style="padding: 7px 10px; color: #475569;">
                        सुबह ऐप खोलें, आज के कार्यों को देखें और पूरे होने पर चेकबॉक्स दबाएँ।
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <td style="padding: 7px 10px;">
                        <strong style="color: #0284c7; font-size: 12px;">🗄️ 2. लॉकर (Vault)</strong><br/>
                        <span style="color: #64748b; font-size: 10px;">Appliances, Gold, Docs</span>
                    </td>
                    <td style="padding: 7px 10px; color: #334155;">
                        &bull; <strong>सामान व बिल:</strong> वारंटी दिन शेष की स्वतः गणना<br/>
                        &bull; <strong>गोल्ड लॉकर:</strong> 22K/24K हॉलमार्क, वजन व मूल्य<br/>
                        &bull; <strong>दस्तावेज़:</strong> आधार, पैन, आयुष्मान कार्ड फोटो के साथ
                    </td>
                    <td style="padding: 7px 10px; color: #475569;">
                        नए सामान या बिल की फोटो खींचकर सुरक्षित रखें। एक्सपायरी पर अलर्ट मिलेगा।
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 7px 10px;">
                        <strong style="color: #e11d48; font-size: 12px;">🔔 3. रिमाइंडर</strong><br/>
                        <span style="color: #64748b; font-size: 10px;">Meds, Birthdays, Bills</span>
                    </td>
                    <td style="padding: 7px 10px; color: #334155;">
                        &bull; <strong>दवा कोर्स:</strong> 10-दिन रीफ़िल व डॉक्टर विज़िट अलर्ट<br/>
                        &bull; <strong>🎂 जन्मदिन व 💐 सालगिरह:</strong> वार्षिक ऑटो-अलर्ट<br/>
                        &bull; <strong>बिजली, गैस व स्कूल फीस:</strong> नियत तारीख अलर्ट
                    </td>
                    <td style="padding: 7px 10px; color: #475569;">
                        '+ रिमाइंडर जोड़ें' दबाएं। कैटेगरी (जन्मदिन/बिल/कार्य) चुनकर तारीख सेट करें।
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <td style="padding: 7px 10px;">
                        <strong style="color: #d97706; font-size: 12px;">🚌 4. बस लाइव</strong><br/>
                        <span style="color: #64748b; font-size: 10px;">Pan-India Bus Safety</span>
                    </td>
                    <td style="padding: 7px 10px; color: #334155;">
                        &bull; 36 राज्य और 750+ ज़िलों की सर्च डायरेक्टरी<br/>
                        &bull; पिकअप व ड्रॉप 2-शिफ्ट टाइमिंग व लाइव ETA<br/>
                        &bull; कंडक्टर उपस्थिति रोस्टर ('सवार ✓' / 'अनुपस्थित')<br/>
                        &bull; 1-टैप ड्राइवर ड्यूटी व Google Maps नेविगेशन
                    </td>
                    <td style="padding: 7px 10px; color: #475569;">
                        माता-पिता बस का लाइव समय देख सकते हैं; ड्राइवर 1-क्लिक में ड्यूटी ऑन करता है।
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 7px 10px;">
                        <strong style="color: #9333ea; font-size: 12px;">✍️ 5. डायरी</strong><br/>
                        <span style="color: #64748b; font-size: 10px;">Creative Diary</span>
                    </td>
                    <td style="padding: 7px 10px; color: #334155;">
                        &bull; कविता व विचारों का डिजिटल संग्रह<br/>
                        &bull; रियल-टाइम सर्च बार व दिनांक फ़िल्टर<br/>
                        &bull; 1-टैप WhatsApp शेयरिंग बटन
                    </td>
                    <td style="padding: 7px 10px; color: #475569;">
                        '+ विचार लिखें' दबाएं। अपनी रचना लिखें व परिवार के साथ WhatsApp पर साझा करें।
                    </td>
                </tr>
                <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                    <td style="padding: 7px 10px;">
                        <strong style="color: #16a34a; font-size: 12px;">👨‍👩‍👧‍👦 6. परिवार</strong><br/>
                        <span style="color: #64748b; font-size: 10px;">Family Connect</span>
                    </td>
                    <td style="padding: 7px 10px; color: #334155;">
                        &bull; फैमिली कोड द्वारा सभी फोनों में लाइव सिंक<br/>
                        &bull; <strong>स्मार्ट इंटरकॉम:</strong> खाना तैयार है / घर पहुँच गया<br/>
                        &bull; सदस्यों की डायरेक्टरी (ब्लड ग्रुप, इमरजेंसी संपर्क)<br/>
                        &bull; <strong>सुरक्षित बैकअप:</strong> ईमेल / WhatsApp पर सम्पूर्ण एक्सपोर्ट
                    </td>
                    <td style="padding: 7px 10px; color: #475569;">
                        घर के सभी फोन में एक ही फैमिली कोड (उदा: MAST-8821) जोड़ें।
                    </td>
                </tr>
            </tbody>
        </table>

        <div style="background-color: #fff7ed; border: 1px solid #fdba74; padding: 10px 14px; border-radius: 8px; margin-top: 14px;">
            <strong style="color: #c2410c; font-size: 12px;">💡 कल स्कूल में लाइव डेमो दिखाने का 1-मिनट प्लान:</strong>
            <ol style="margin: 4px 0 0 16px; padding: 0; color: #7c2d12; font-size: 11px;">
                <li><strong>भाषा बदलें:</strong> ऊपर 'English' दबाएं, पूरा ऐप अंग्रेजी में दिखेगा; फिर 'हिंदी' दबाएं।</li>
                <li><strong>बस लाइव दिखाएं:</strong> मॉर्निंग पिकअप रूट दिखाएं, फिर ड्राइवर मोड में कंडक्टर द्वारा 'सवार ✓' दबाकर दिखाएं।</li>
                <li><strong>होम स्क्रीन टास्क:</strong> दिखाएं कि सुबह आज का काम कैसे होम स्क्रीन पर टिक करने के लिए सामने आता है।</li>
                <li><strong>स्कूल फीस ऑटो-अलर्ट:</strong> दिखाएं कि बस की फीस अपने-आप होम और रिमाइंडर में जुड़ी रहती है।</li>
            </ol>
        </div>

        <div style="text-align: center; color: #94a3b8; font-size: 10px; margin-top: 20px;">
            MAST Life Operating System &bull; परिवार व स्कूल का 100% सुरक्षित डिजिटल ऑपरेटिंग सिस्टम &bull; &copy; 2026
        </div>
    </div>
    """
    page2.insert_htmlbox(body_rect2, body_html2)
    
    # Save the document
    doc.save("E:/MAST/docs/MAST_User_Manual_and_School_Guide.pdf")
    print("PDF generated successfully with PyMuPDF!")

if __name__ == "__main__":
    create_manual_pdf()
