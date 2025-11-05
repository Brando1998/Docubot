package main

import (
	"bufio"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"

	"github.com/brando1998/docubot-api/config"
	database "github.com/brando1998/docubot-api/databases"
	"github.com/brando1998/docubot-api/models"
)

func main() {
	// Parse command line flags
	listFlag := flag.Bool("list", false, "List admin users without interactive reset")
	flag.Parse()

	if *listFlag {
		listAdmins()
		return
	}

	fmt.Println("🤖 Docubot - Reset de Credenciales de Admin")
	fmt.Println("==========================================")
	fmt.Println()

	// Cargar configuración
	config.LoadEnv()

	// Conectar a la base de datos
	if err := database.ConnectPostgres(); err != nil {
		log.Fatalf("❌ Error al conectar a PostgreSQL: %v", err)
	}

	db := database.GetDB()

	// Listar usuarios administradores existentes
	var admins []models.SystemUser
	if err := db.Where("role = ?", "admin").Find(&admins).Error; err != nil {
		log.Fatalf("❌ Error al buscar administradores: %v", err)
	}

	if len(admins) == 0 {
		fmt.Println("⚠️  No se encontraron usuarios administradores en el sistema.")
		fmt.Println("💡 Tip: Reinicia la API para crear el usuario admin por defecto.")
		return
	}

	fmt.Printf("🔍 Administradores encontrados (%d):\n", len(admins))
	fmt.Println("=====================================")
	for i, admin := range admins {
		fmt.Printf("[%d] ID: %d | Username: %s | Email: %s | Activo: %t\n",
			i+1, admin.ID, admin.Username, admin.Email, admin.IsActive)
	}
	fmt.Println()

	// Seleccionar usuario a resetear
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("🎯 Selecciona el número del admin a resetear [1]: ")
	selectionStr, _ := reader.ReadString('\n')
	selectionStr = strings.TrimSpace(selectionStr)

	selection := 1
	if selectionStr != "" {
		if _, err := fmt.Sscanf(selectionStr, "%d", &selection); err != nil {
			log.Fatal("❌ Selección inválida")
		}
	}

	if selection < 1 || selection > len(admins) {
		log.Fatal("❌ Número de selección fuera de rango")
	}

	selectedAdmin := &admins[selection-1]

	fmt.Printf("\n✅ Seleccionado: %s (%s)\n", selectedAdmin.Username, selectedAdmin.Email)
	fmt.Println()

	// Solicitar nueva contraseña
	fmt.Print("🔒 Nueva contraseña: ")
	passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		log.Fatal("❌ Error al leer la contraseña")
	}
	password := string(passwordBytes)
	fmt.Println() // Nueva línea

	if len(password) < 6 {
		log.Fatal("❌ La contraseña debe tener al menos 6 caracteres")
	}

	// Confirmar contraseña
	fmt.Print("🔒 Confirmar nueva contraseña: ")
	confirmPasswordBytes, err := term.ReadPassword(int(syscall.Stdin))
	if err != nil {
		log.Fatal("❌ Error al leer la confirmación")
	}
	confirmPassword := string(confirmPasswordBytes)
	fmt.Println() // Nueva línea

	if password != confirmPassword {
		log.Fatal("❌ Las contraseñas no coinciden")
	}

	// Hash de la nueva contraseña
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("❌ Error al hash la contraseña: %v", err)
	}

	// Actualizar en la base de datos
	selectedAdmin.PasswordHash = string(hashedPassword)
	if err := db.Save(selectedAdmin).Error; err != nil {
		log.Fatalf("❌ Error al actualizar la contraseña: %v", err)
	}

	fmt.Println()
	fmt.Println("🎉 ¡Contraseña actualizada exitosamente!")
	fmt.Printf("📝 Username: %s\n", selectedAdmin.Username)
	fmt.Printf("📧 Email: %s\n", selectedAdmin.Email)
	fmt.Printf("🕒 Actualizado: %s\n", selectedAdmin.UpdatedAt.Format("2006-01-02 15:04:05"))
	fmt.Println()
	fmt.Println("💡 Ya puedes hacer login con las nuevas credenciales.")
}

func listAdmins() {
	// Cargar configuración
	config.LoadEnv()

	// Conectar a la base de datos
	if err := database.ConnectPostgres(); err != nil {
		log.Fatalf("❌ Error al conectar a PostgreSQL: %v", err)
	}

	db := database.GetDB()

	// Listar usuarios administradores existentes
	var admins []models.SystemUser
	if err := db.Where("role = ?", "admin").Find(&admins).Error; err != nil {
		log.Fatalf("❌ Error al buscar administradores: %v", err)
	}

	if len(admins) == 0 {
		fmt.Println("⚠️  No se encontraron usuarios administradores en el sistema.")
		fmt.Println("💡 Tip: Reinicia la API para crear el usuario admin por defecto.")
		return
	}

	fmt.Printf("🔍 Administradores encontrados (%d):\n", len(admins))
	fmt.Println("=====================================")
	for _, admin := range admins {
		fmt.Printf("ID: %d | Username: %s | Email: %s | Active: %t\n",
			admin.ID, admin.Username, admin.Email, admin.IsActive)
	}
}
