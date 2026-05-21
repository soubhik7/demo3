using OnboardingApp.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddSingleton<PythonRunner>();

var app = builder.Build();

// Serve wwwroot/index.html for GET /
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

app.Run();
