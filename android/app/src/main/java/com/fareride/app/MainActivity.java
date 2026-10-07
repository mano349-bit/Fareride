package com.fareride.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.*;
import android.webkit.*;
import android.widget.*;

public final class MainActivity extends Activity {
 private static final String BASE="https://mano349-bit.github.io/Fareride/";
 private WebView web; private ProgressBar progress; private LinearLayout errors;
 private ValueCallback<Uri[]> files; private GeolocationPermissions.Callback geo; private String origin;
 private boolean trusted(String url){if(url==null)return false;Uri u=Uri.parse(url);return "https".equals(u.getScheme())&&"mano349-bit.github.io".equals(u.getHost())&&u.getPort()==-1&&u.getUserInfo()==null&&u.getPath()!=null&&u.getPath().startsWith("/Fareride/");}
 @Override public void onCreate(Bundle state){
  super.onCreate(state);LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.WHITE);setContentView(root);
  root.setOnApplyWindowInsetsListener((v,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets e=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());root.setPadding(e.left,e.top,e.right,e.bottom);}else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
  TextView title=new TextView(this);title.setText("FareRide");title.setTextSize(22);title.setTextColor(Color.WHITE);title.setPadding(24,16,24,16);title.setBackgroundColor(Color.rgb(20,115,230));root.addView(title);
  progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);root.addView(progress,new LinearLayout.LayoutParams(-1,6));
  errors=new LinearLayout(this);errors.setOrientation(LinearLayout.VERTICAL);TextView text=new TextView(this);text.setText("FareRide could not load. Check your internet connection.");errors.addView(text);Button retry=new Button(this);retry.setText("Retry");retry.setOnClickListener(v->web.reload());errors.addView(retry);errors.setVisibility(View.GONE);root.addView(errors);
  web=new WebView(this);root.addView(web,new LinearLayout.LayoutParams(-1,0,1));
  LinearLayout nav=new LinearLayout(this);root.addView(nav);String[] names={"Home","Rider","Driver","Refresh"};String[] pages={"index.html","rider-login.html","driver-login.html",null};for(int i=0;i<4;i++){String page=pages[i];Button b=new Button(this);b.setText(names[i]);b.setTextSize(12);nav.addView(b,new LinearLayout.LayoutParams(0,-2,1));b.setOnClickListener(v->{if(page==null)web.reload();else web.loadUrl(BASE+page);});}
  WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setGeolocationEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setMediaPlaybackRequiresUserGesture(true);
  CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){if(trusted(request.getUrl().toString()))return false;if(request.isForMainFrame())external(request.getUrl());return true;}
   @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){errors.setVisibility(View.GONE);}
   @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())errors.setVisibility(View.VISIBLE);}
  });
  web.setWebChromeClient(new WebChromeClient(){
   @Override public void onProgressChanged(WebView view,int value){progress.setProgress(value);progress.setVisibility(value==100?View.GONE:View.VISIBLE);}
   @Override public void onGeolocationPermissionsShowPrompt(String requestedOrigin,GeolocationPermissions.Callback callback){
    if(!"https://mano349-bit.github.io".equals(requestedOrigin.replaceAll("/$",""))||!trusted(web.getUrl())||geo!=null){callback.invoke(requestedOrigin,false,false);return;}
    geo=callback;origin=requestedOrigin;if(hasLocation())finishGeo(true);else new AlertDialog.Builder(MainActivity.this).setTitle("FareRide location").setMessage("Allow location for your live ride map and SOS while FareRide is open?").setPositiveButton("Continue",(d,w)->requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},100)).setNegativeButton("Not now",(d,w)->finishGeo(false)).setOnCancelListener(d->finishGeo(false)).show();
   }
   @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(!trusted(web.getUrl())){callback.onReceiveValue(null);return true;}if(files!=null)files.onReceiveValue(null);files=callback;Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT);picker.addCategory(Intent.CATEGORY_OPENABLE);picker.setType("*/*");picker.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/*","application/pdf"});picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);try{startActivityForResult(picker,101);}catch(ActivityNotFoundException e){files.onReceiveValue(null);files=null;Toast.makeText(MainActivity.this,"Document picker unavailable",Toast.LENGTH_LONG).show();}return true;}
  });
  if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->{if(web.canGoBack())web.goBack();else finish();});
  if(state==null||web.restoreState(state)==null)web.loadUrl(BASE+"index.html");
 }
 private boolean hasLocation(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
 private void finishGeo(boolean allow){if(geo!=null){geo.invoke(origin,allow&&trusted(web.getUrl()),false);geo=null;origin=null;}}
 private void external(Uri uri){String scheme=uri.getScheme();Intent intent;if("tel".equals(scheme))intent=new Intent(Intent.ACTION_DIAL,uri);else if("mailto".equals(scheme)||"sms".equals(scheme))intent=new Intent(Intent.ACTION_SENDTO,uri);else if("https".equals(scheme))intent=new Intent(Intent.ACTION_VIEW,uri);else return;try{startActivity(intent);}catch(ActivityNotFoundException e){Toast.makeText(this,"No app available for this link",Toast.LENGTH_LONG).show();}}
 @Override public void onRequestPermissionsResult(int request,String[] p,int[] result){super.onRequestPermissionsResult(request,p,result);if(request==100)finishGeo(hasLocation());}
 @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==101&&files!=null){Uri[] selected=null;if(result==RESULT_OK&&data!=null&&trusted(web.getUrl())){if(data.getClipData()!=null){selected=new Uri[data.getClipData().getItemCount()];for(int i=0;i<selected.length;i++)selected[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)selected=new Uri[]{data.getData()};}files.onReceiveValue(selected);files=null;}}
 @Override protected void onSaveInstanceState(Bundle state){web.saveState(state);super.onSaveInstanceState(state);}
 @android.annotation.SuppressLint("GestureBackNavigation") // Legacy Android 8-12; Android 13+ uses OnBackInvokedDispatcher above.
 @Override public void onBackPressed(){if(web.canGoBack())web.goBack();else super.onBackPressed();}
 @Override protected void onPause(){web.onPause();web.pauseTimers();super.onPause();}
 @Override protected void onResume(){super.onResume();if(web!=null){web.resumeTimers();web.onResume();}}
 @Override protected void onDestroy(){finishGeo(false);if(files!=null)files.onReceiveValue(null);web.destroy();super.onDestroy();}
}

